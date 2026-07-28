import { Notice, Plugin, TFile, type TAbstractFile } from "obsidian";

import { AdvanceCycleUseCase } from "@/application/use-cases/AdvanceCycleUseCase";
import { ChangelogService } from "@/application/services/ChangelogService";
import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import type { PluginDataStore as PluginDataStorePort } from "@/application/ports/PluginDataStore";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { ObsidianMarkdownFileStore } from "@/infrastructure/obsidian/ObsidianMarkdownFileStore";
import { ObsidianStorageAdapter } from "@/infrastructure/obsidian/ObsidianStorageAdapter";
import { Schema2AtomicWriter } from "@/infrastructure/markdown/schema2/Schema2AtomicWriter";
import type { Schema2MarkdownFile } from "@/infrastructure/markdown/schema2/Schema2WorkspaceIndex";
import {
  renderSchema2DiagnosticsMarkdown,
  Schema2WorkspaceValidator
} from "@/infrastructure/markdown/schema2/Schema2WorkspaceValidator";
import { Schema2BackupRecoveryService } from "@/infrastructure/persistence/Schema2BackupRecoveryService";
import { Schema2PluginDataStore } from "@/infrastructure/persistence/Schema2PluginDataStore";
import { BUNDLED_RELEASES } from "@/releases/bundledReleases";
import { ChangelogModal } from "@/ui/changelog/ChangelogModal";
import { BackupRecoveryPickerModal } from "@/ui/recovery/BackupRecoveryPickerModal";
import type { LeifTabId } from "@/ui/constants";
import { LEIF_VIEW_TYPE, openLeifView, registerLeifView } from "@/ui/view/registerLeifView";
import type { LeifView } from "@/ui/view/LeifView";

const MARKDOWN_SYNC_DEBOUNCE_MS = 400;
const SELF_WRITE_SUPPRESSION_MS = MARKDOWN_SYNC_DEBOUNCE_MS * 2;

export default class LeifPlugin extends Plugin {
  private dataStore!: PluginDataStorePort;
  private markdownStore!: MarkdownFileStore;
  private markdownSyncTimer?: number;
  private markdownSyncInProgress = false;
  private readonly suppressedSelfWritePaths = new Map<string, number>();

  override onload(): void {
    void this.initialize();
  }

  async initialize(): Promise<void> {
    const storageAdapter = new ObsidianStorageAdapter(this);
    const markdownStore = new ObsidianMarkdownFileStore(this.app.vault);
    this.markdownStore = markdownStore;
    this.dataStore = new Schema2PluginDataStore(storageAdapter, markdownStore);
    const backupRecovery = new Schema2BackupRecoveryService(markdownStore, () => "manual");
    const diagnosticsWriter = new Schema2AtomicWriter(markdownStore);
    const data = await this.dataStore.load();

    registerLeifView(this, this.dataStore);
    this.registerStudyCommands();
    this.registerMarkdownCommands(markdownStore, diagnosticsWriter);
    this.registerMarkdownWatcher();
    this.registerRecoveryCommand(backupRecovery, diagnosticsWriter);
    await this.syncMarkdownWorkspaceSilently();

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

  private registerStudyCommands(): void {
    this.addCommand({
      id: "open-today",
      name: "Abrir Hoje",
      callback: async () => {
        await this.openLeifTab("dashboard");
      }
    });

    this.addCommand({
      id: "new-study-records",
      name: "Novos registros",
      callback: async () => {
        await this.openLeifTab("records");
      }
    });

    this.addCommand({
      id: "register-recommended-study",
      name: "Registrar estudo recomendado",
      callback: async () => {
        await this.openLeifTab("records");
      }
    });

    this.addCommand({
      id: "advance-cycle-without-record",
      name: "Avançar recomendação",
      callback: async () => {
        await this.advanceCycleWithoutRecord();
      }
    });
  }

  private registerMarkdownCommands(
    markdownStore: MarkdownFileStore,
    diagnosticsWriter: Schema2AtomicWriter
  ): void {
    this.addCommand({
      id: "validate-markdown",
      name: "Validar Markdown",
      callback: async () => {
        await this.validateMarkdownWorkspace(markdownStore, diagnosticsWriter);
      }
    });

    this.addCommand({
      id: "validate-and-sync-markdown",
      name: "Validar e sincronizar Markdown",
      callback: async () => {
        await this.syncMarkdownWorkspace();
      }
    });

    this.addCommand({
      id: "open-diagnostics",
      name: "Abrir relatório de diagnósticos",
      callback: async () => {
        if (!(await markdownStore.exists("Leif/diagnosticos.md"))) {
          await this.validateMarkdownWorkspace(markdownStore, diagnosticsWriter);
        }

        const diagnosticsFile = this.app.vault.getAbstractFileByPath("Leif/diagnosticos.md");
        if (!(diagnosticsFile instanceof TFile)) {
          new Notice("Relatório de diagnósticos não encontrado.");
          return;
        }

        const leaf = this.app.workspace.getLeaf();
        await leaf.openFile(diagnosticsFile);
        this.app.workspace.setActiveLeaf(leaf, { focus: true });
      }
    });

    this.addCommand({
      id: "create-backup",
      name: "Criar backup agora",
      callback: async () => {
        await this.createManualBackup(markdownStore);
      }
    });
  }

  private async openLeifTab(tabId: LeifTabId): Promise<void> {
    await openLeifView(this);
    const leaf = this.app.workspace.getLeavesOfType(LEIF_VIEW_TYPE)[0];
    const view = leaf?.view as { openTab?: (tabId: LeifTabId) => Promise<void> } | undefined;
    if (typeof view?.openTab !== "function") return;
    await view.openTab(tabId);
  }

  private async advanceCycleWithoutRecord(): Promise<void> {
    try {
      const result = await new AdvanceCycleUseCase(this.dataStore).execute();
      await this.refreshOpenLeifViews();
      const data = await this.dataStore.load();
      const subject = data.subjects.find((entry) => entry.id === result.current.subjectId);
      new Notice(`Recomendação avançada para ${subject?.name ?? "a próxima matéria"}.`);
    } catch {
      await this.refreshOpenLeifViews();
      new Notice("Não foi possível avançar a recomendação.");
    }
  }

  private async createManualBackup(markdownStore: MarkdownFileStore): Promise<void> {
    const files: Schema2MarkdownFile[] = [];
    for (const path of (await markdownStore.list("Leif/concursos")).filter((entry) =>
      entry.endsWith(".md")
    )) {
      files.push({ path, content: await markdownStore.read(path) });
    }
    const backupRoot = `Leif/.backups/manual-${Date.now().toString(36)}`;
    await markdownStore.writeNew(
      `${backupRoot}/manifest.json`,
      `${JSON.stringify({ files }, null, 2)}\n`
    );
    new Notice(`Backup criado em ${backupRoot}.`);
  }

  private async validateMarkdownWorkspace(
    markdownStore: MarkdownFileStore,
    diagnosticsWriter: Schema2AtomicWriter
  ): Promise<void> {
    const diagnostics = Schema2WorkspaceValidator.validate(
      await readSchema2MarkdownFiles(markdownStore)
    );
    await diagnosticsWriter.writeDiagnostics(renderSchema2DiagnosticsMarkdown(diagnostics), {
      transactionId: "manual-validation"
    });
    new Notice(
      diagnostics.length === 0
        ? "Validação concluída: nenhum problema encontrado."
        : "Validação concluída: relatório salvo em Leif/diagnosticos.md."
    );
  }

  private async syncMarkdownWorkspace(): Promise<void> {
    try {
      await this.runMarkdownSync();
      await this.refreshOpenLeifViews();
      new Notice("Sincronização concluída: nenhum problema encontrado.");
    } catch {
      await this.refreshOpenLeifViews();
      new Notice("Sincronização bloqueada: relatório salvo em Leif/diagnosticos.md.");
    }
  }

  private registerMarkdownWatcher(): void {
    const scheduleForFile = (file: TAbstractFile) => {
      this.scheduleMarkdownSyncForPath(file.path);
    };

    this.registerEvent(this.app.vault.on("create", scheduleForFile));
    this.registerEvent(this.app.vault.on("modify", scheduleForFile));
    this.registerEvent(this.app.vault.on("delete", scheduleForFile));
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.scheduleMarkdownSyncForPath(oldPath);
        this.scheduleMarkdownSyncForPath(file.path);
      })
    );
  }

  private scheduleMarkdownSyncForPath(path: string): void {
    const normalized = normalizeLeifPath(path);
    if (!shouldScheduleMarkdownSync(normalized)) return;
    if (this.markdownSyncInProgress) return;
    if (consumeSuppressedSelfWritePath(normalized, this.suppressedSelfWritePaths)) return;
    if (this.markdownSyncTimer) {
      window.clearTimeout(this.markdownSyncTimer);
    }
    this.markdownSyncTimer = window.setTimeout(() => {
      this.markdownSyncTimer = undefined;
      void this.syncMarkdownWorkspaceSilently();
    }, MARKDOWN_SYNC_DEBOUNCE_MS);
  }

  private async syncMarkdownWorkspaceSilently(): Promise<void> {
    try {
      await this.runMarkdownSync();
    } catch {
      // Diagnostics are generated by the data store when synchronization is blocked.
    }
    await this.refreshOpenLeifViews();
  }

  private async runMarkdownSync(): Promise<void> {
    if (this.markdownSyncInProgress) return;
    this.markdownSyncInProgress = true;
    try {
      const before = await this.snapshotSyncRelevantFiles();
      const data = await this.dataStore.load();
      await this.dataStore.save(data);
      const after = await this.snapshotSyncRelevantFiles();
      markChangedPathsForSuppression(before, after, this.suppressedSelfWritePaths);
    } finally {
      this.markdownSyncInProgress = false;
    }
  }

  private async snapshotSyncRelevantFiles(): Promise<Map<string, string>> {
    const paths = (await this.markdownStore.list("Leif/concursos")).filter((path) =>
      path.endsWith(".md")
    );
    const snapshot = new Map<string, string>();
    for (const path of paths) {
      snapshot.set(normalizeLeifPath(path), await this.markdownStore.read(path));
    }
    return snapshot;
  }

  private async refreshOpenLeifViews(): Promise<void> {
    await Promise.all(
      this.app.workspace.getLeavesOfType(LEIF_VIEW_TYPE).map(async (leaf) => {
        const view = leaf.view as LeifView | null;
        if (!view || typeof view.render !== "function") return;
        await view.render();
      })
    );
  }

  private registerRecoveryCommand(
    backupRecovery: Schema2BackupRecoveryService,
    diagnosticsWriter: Schema2AtomicWriter
  ): void {
    this.addCommand({
      id: "recover-backup",
      name: "Recuperar backup",
      callback: async () => {
        const backups = await backupRecovery.listCompatibleBackups();
        if (backups.length === 0) {
          new Notice("Nenhum backup compatível encontrado.");
          return;
        }
        if (backups.length === 1) {
          await this.restoreBackup(backups[0], backupRecovery, diagnosticsWriter);
          return;
        }
        new BackupRecoveryPickerModal(this.app, backups, (backupPath) =>
          this.restoreBackup(backupPath, backupRecovery, diagnosticsWriter)
        ).open();
      }
    });
  }

  private async restoreBackup(
    backupPath: string,
    backupRecovery: Schema2BackupRecoveryService,
    diagnosticsWriter: Schema2AtomicWriter
  ): Promise<void> {
    const result = await backupRecovery.restoreBackupToStaging(backupPath);
    if (result.diagnostics.length > 0) {
      await diagnosticsWriter.writeDiagnostics(
        renderSchema2DiagnosticsMarkdown(result.diagnostics),
        {
          transactionId: "recovery-diagnostics"
        }
      );
      new Notice("Backup não recuperado: relatório salvo em Leif/diagnosticos.md.");
      return;
    }
    new Notice(`Backup recuperado em ${result.stagingRoot}.`);
  }
}

function isFreshInstall(data: LeifPluginData): boolean {
  return (
    data.contests.length === 0 &&
    data.subjects.length === 0 &&
    data.topics.length === 0 &&
    data.resources.length === 0 &&
    data.studyRecords.length === 0
  );
}

async function readSchema2MarkdownFiles(
  markdownStore: MarkdownFileStore
): Promise<Schema2MarkdownFile[]> {
  const paths = (await markdownStore.list("Leif/concursos")).filter((path) => path.endsWith(".md"));
  const files: Schema2MarkdownFile[] = [];
  for (const path of paths) {
    files.push({ path, content: await markdownStore.read(path) });
  }
  return files;
}

function shouldScheduleMarkdownSync(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized !== "Leif" && !normalized.startsWith("Leif/")) return false;
  if (normalized === "Leif/diagnosticos.md") return false;
  const segments = normalized.split("/");
  return !segments.includes(".staging") && !segments.includes(".backups");
}

function markChangedPathsForSuppression(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
  suppressedPaths: Map<string, number>
): void {
  const paths = new Set([...before.keys(), ...after.keys()]);
  paths.forEach((path) => {
    if (before.get(path) !== after.get(path)) {
      suppressedPaths.set(path, Date.now() + SELF_WRITE_SUPPRESSION_MS);
    }
  });
}

function normalizeLeifPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function consumeSuppressedSelfWritePath(
  path: string,
  suppressedPaths: Map<string, number>
): boolean {
  const now = Date.now();
  suppressedPaths.forEach((expiresAt, suppressedPath) => {
    if (expiresAt <= now) {
      suppressedPaths.delete(suppressedPath);
    }
  });
  const expiresAt = suppressedPaths.get(path);
  if (!expiresAt || expiresAt <= now) return false;
  return true;
}
