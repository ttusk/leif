/**
 * Operational state owned by plugin JSON. Study content (concursos, matérias,
 * assuntos, recursos, registros, mural and cycle position) lives in
 * Markdown and never appears here.
 */

export const STORAGE_SCHEMA_VERSION = 4;

export type MigrationSource =
  | "legacy-json"
  | "markdown-schema-1"
  | "markdown-schema-2-sessions";
export type MigrationStatus = "started" | "migrated" | "failed";

export interface MigrationDiagnostic {
  code: string;
  message: string;
}

/**
 * Receipt of an automatic per-concurso migration into Markdown schema 2.
 * A failed concurso stays read-only; the receipt explains why.
 */
export interface MigrationReceipt {
  id: string;
  contestId: string;
  source: MigrationSource;
  status: MigrationStatus;
  backupPath?: string;
  diagnostics: MigrationDiagnostic[];
  createdAt: string;
  completedAt?: string;
}

export interface LeifRuntimeState {
  storageSchemaVersion: typeof STORAGE_SCHEMA_VERSION;
  markdownRoot: string;
  migrationReceipts: MigrationReceipt[];
  lastAcknowledgedVersion?: string;
}

export function createDefaultLeifRuntimeState(): LeifRuntimeState {
  return {
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    markdownRoot: "Leif",
    migrationReceipts: []
  };
}
