import { Plugin } from "obsidian";

import { ChangelogService } from "@/application/services/ChangelogService";
import { LegacyUpgradeBackupService } from "@/application/services/LegacyUpgradeBackupService";
import type { PluginDataStore as PluginDataStorePort } from "@/application/ports/PluginDataStore";
import { StagedMarkdownMigrationService } from "@/application/services/StagedMarkdownMigrationService";
import { MarkdownRollbackService } from "@/application/services/MarkdownRollbackService";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { ObsidianStorageAdapter } from "@/infrastructure/obsidian/ObsidianStorageAdapter";
import { ObsidianMarkdownFileStore } from "@/infrastructure/obsidian/ObsidianMarkdownFileStore";
import { MarkdownContestIndex } from "@/infrastructure/markdown/MarkdownContestIndex";
import { MarkdownContestWriter } from "@/infrastructure/markdown/MarkdownContestWriter";
import { MarkdownAwarePluginDataStore } from "@/infrastructure/persistence/MarkdownAwarePluginDataStore";
import { BUNDLED_RELEASES } from "@/releases/bundledReleases";
import { ChangelogModal } from "@/ui/changelog/ChangelogModal";
import { registerMarkdownMigration } from "@/ui/migration/registerMarkdownMigration";
import { registerLeifView } from "@/ui/view/registerLeifView";

export default class LeifPlugin extends Plugin {
  private dataStore!: PluginDataStorePort;

  override async onload(): Promise<void> {
    const storageAdapter = new ObsidianStorageAdapter(this);
    const markdownFiles = new ObsidianMarkdownFileStore(this.app.vault);
    const rawData = await storageAdapter.load();
    await new LegacyUpgradeBackupService(markdownFiles).ensureBackup(rawData);

    const legacyStore = new PluginDataStore(storageAdapter);
    this.dataStore = new MarkdownAwarePluginDataStore(
      legacyStore,
      new MarkdownContestIndex(markdownFiles),
      new MarkdownContestWriter(markdownFiles)
    );
    const migration = new StagedMarkdownMigrationService(this.dataStore, markdownFiles);
    const data = await this.dataStore.load();

    registerLeifView(this, this.dataStore);
    registerMarkdownMigration(
      this,
      this.dataStore,
      migration,
      new MarkdownRollbackService(legacyStore)
    );

    if (!data.runtimeState!.lastAcknowledgedVersion && isFreshInstall(data)) {
      await this.acknowledgeVersion(this.manifest.version);
      return;
    }

    this.app.workspace.onLayoutReady(() => {
      void this.showChangelogAfterUpdate(data);
    });
  }

  private async showChangelogAfterUpdate(data: LeifPluginData): Promise<void> {
    const currentVersion = this.manifest.version;
    const runtimeState = data.runtimeState!;

    const release = new ChangelogService(BUNDLED_RELEASES).pendingRelease(
      currentVersion,
      runtimeState
    );
    if (!release) return;

    new ChangelogModal(this.app, release, () => this.acknowledgeVersion(currentVersion)).open();
  }

  private async acknowledgeVersion(version: string): Promise<void> {
    await this.dataStore.mutate((data) => {
      data.runtimeState = {
        ...data.runtimeState!,
        lastAcknowledgedVersion: version
      };
    });
  }
}

function isFreshInstall(data: LeifPluginData): boolean {
  return (
    data.contests.length === 0 &&
    data.subjects.length === 0 &&
    data.topics.length === 0 &&
    data.studyItems.length === 0 &&
    data.studySessions.length === 0
  );
}
