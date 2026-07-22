import { Plugin } from "obsidian";

import { ChangelogService } from "@/application/services/ChangelogService";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { ObsidianStorageAdapter } from "@/infrastructure/obsidian/ObsidianStorageAdapter";
import { BUNDLED_RELEASES } from "@/releases/bundledReleases";
import { ChangelogModal } from "@/ui/changelog/ChangelogModal";
import { registerLeifView } from "@/ui/view/registerLeifView";

export default class LeifPlugin extends Plugin {
  private dataStore!: PluginDataStore;

  override async onload(): Promise<void> {
    this.dataStore = new PluginDataStore(new ObsidianStorageAdapter(this));
    const data = await this.dataStore.load();

    registerLeifView(this, this.dataStore);

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
