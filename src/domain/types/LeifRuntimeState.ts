export type ContestStorageMode = "legacy-json" | "vault-markdown";

export type MigrationStatus = "backed-up" | "verified" | "activated" | "rolled-back";

export interface MigrationReceipt {
  id: string;
  contestId: string;
  status: MigrationStatus;
  backupPath: string;
  backupChecksum: string;
  sourceChecksum: string;
  targetChecksum?: string;
  createdAt: string;
  verifiedAt?: string;
  activatedAt?: string;
}

export interface LeifRuntimeState {
  storageSchemaVersion: 2;
  markdownRoot: string;
  contestStorage: Record<string, ContestStorageMode>;
  migrationReceipts: MigrationReceipt[];
  lastAcknowledgedVersion?: string;
}

export function createDefaultLeifRuntimeState(): LeifRuntimeState {
  return {
    storageSchemaVersion: 2,
    markdownRoot: "Leif",
    contestStorage: {},
    migrationReceipts: []
  };
}
