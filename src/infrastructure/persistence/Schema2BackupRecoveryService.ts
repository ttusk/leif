import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import {
  Schema1MarkdownProjector,
  type Schema1MarkdownFile
} from "@/infrastructure/markdown/schema1/Schema1MarkdownProjector";
import {
  Schema2WorkspaceValidator,
  type Schema2Diagnostic
} from "@/infrastructure/markdown/schema2/Schema2WorkspaceValidator";
import { Schema2WorkspacePlanner } from "@/infrastructure/markdown/schema2/Schema2WorkspacePlanner";
import { DataMigrationService } from "@/infrastructure/persistence/DataMigrations";

export interface Schema2BackupRecoveryResult {
  backupPath: string;
  stagingRoot: string;
  files: string[];
  diagnostics: Schema2Diagnostic[];
}

export interface Schema2BackupActivationResult {
  stagingRoot: string;
  files: string[];
  diagnostics: Schema2Diagnostic[];
}

export class Schema2BackupRecoveryService {
  private readonly migrationService = new DataMigrationService();

  constructor(
    private readonly markdownStore: MarkdownFileStore,
    private readonly transactionIdFactory: () => string = () => Date.now().toString(36)
  ) {}

  async listCompatibleBackups(): Promise<string[]> {
    return (await this.markdownStore.list("Leif/.backups"))
      .filter((path) => path.endsWith("/data.json") || path.endsWith("/manifest.json"))
      .sort((left, right) => left.localeCompare(right));
  }

  async restoreJsonBackupToStaging(backupPath: string): Promise<Schema2BackupRecoveryResult> {
    return this.restoreBackupToStaging(backupPath);
  }

  async restoreBackupToStaging(backupPath: string): Promise<Schema2BackupRecoveryResult> {
    const data = backupPath.endsWith("/manifest.json")
      ? await this.projectSchema1ManifestBackup(backupPath)
      : await this.projectJsonBackup(backupPath);
    return this.restoreDataToStaging(backupPath, data);
  }

  async activateStagedRecovery(stagingRoot: string): Promise<Schema2BackupActivationResult> {
    const stagedPaths = (await this.markdownStore.list(`${stagingRoot}/Leif/concursos`))
      .filter((path) => path.endsWith(".md"))
      .sort((left, right) => left.localeCompare(right));
    const stagedFiles = await Promise.all(
      stagedPaths.map(async (path) => ({
        path: unstagePath(stagingRoot, path),
        stagedPath: path,
        content: await this.markdownStore.read(path)
      }))
    );
    const diagnostics = Schema2WorkspaceValidator.validate(
      stagedFiles.map(({ path, content }) => ({ path, content }))
    );
    if (diagnostics.length > 0) {
      return {
        stagingRoot,
        files: stagedFiles.map((file) => file.path),
        diagnostics
      };
    }

    for (const file of stagedFiles) {
      if (await this.markdownStore.exists(file.path)) {
        throw new Error(`Recovery destination "${file.path}" already exists.`);
      }
    }

    for (const file of stagedFiles) {
      await this.markdownStore.move(file.stagedPath, file.path);
    }

    return {
      stagingRoot,
      files: stagedFiles.map((file) => file.path),
      diagnostics: []
    };
  }

  private async projectJsonBackup(backupPath: string): Promise<LeifPluginData> {
    const backup = JSON.parse(await this.markdownStore.read(backupPath)) as LeifPluginData;
    return this.migrationService.migrate(backup);
  }

  private async projectSchema1ManifestBackup(backupPath: string): Promise<LeifPluginData> {
    const manifest = JSON.parse(await this.markdownStore.read(backupPath)) as {
      files?: Schema1MarkdownFile[];
    };
    if (!Array.isArray(manifest.files)) {
      throw new Error(`Backup manifest "${backupPath}" does not contain a files array.`);
    }
    return {
      ...this.migrationService.migrate({} as LeifPluginData),
      ...Schema1MarkdownProjector.project(manifest.files)
    };
  }

  private async restoreDataToStaging(
    backupPath: string,
    data: LeifPluginData
  ): Promise<Schema2BackupRecoveryResult> {
    const stagingRoot = `Leif/.staging/recovery-${this.transactionIdFactory()}`;
    let plan: ReturnType<typeof Schema2WorkspacePlanner.plan>;
    try {
      plan = Schema2WorkspacePlanner.plan(data, []);
    } catch (error) {
      return {
        backupPath,
        stagingRoot,
        files: [],
        diagnostics: [
          {
            code: "SCHEMA2_RECOVERY_FAILED",
            severity: "erro",
            path: backupPath,
            message:
              error instanceof Error
                ? error.message
                : "Backup recovery could not build a schema-2 plan.",
            guidance:
              "Escolha outro backup ou corrija a origem antes de tentar recuperar novamente."
          }
        ]
      };
    }
    const createChanges = plan.changes.filter((change) => change.kind === "create");

    if (plan.diagnostics.length === 0) {
      for (const change of createChanges) {
        const path = stagePath(stagingRoot, change.path);
        if (await this.markdownStore.exists(path)) {
          const current = await this.markdownStore.read(path);
          if (current === change.content) continue;
          throw new Error(`Recovery staging path "${path}" already exists with different content.`);
        }
        await this.markdownStore.writeNew(path, change.content);
      }
    }

    return {
      backupPath,
      stagingRoot,
      files: createChanges.map((change) => stagePath(stagingRoot, change.path)),
      diagnostics: plan.diagnostics
    };
  }
}

function stagePath(stagingRoot: string, finalPath: string): string {
  return finalPath.replace(/^Leif\//, `${stagingRoot}/Leif/`);
}

function unstagePath(stagingRoot: string, stagedPath: string): string {
  const prefix = `${stagingRoot}/`;
  if (!stagedPath.startsWith(prefix)) {
    throw new Error(`Recovery staging path "${stagedPath}" is outside "${stagingRoot}".`);
  }
  return stagedPath.slice(prefix.length);
}
