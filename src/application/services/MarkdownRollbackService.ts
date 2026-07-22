import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { MigrationSafetyService } from "@/application/services/MigrationSafetyService";
import type { MigrationReceipt } from "@/domain/types/LeifRuntimeState";

export class MarkdownRollbackService {
  private readonly safety = new MigrationSafetyService();

  constructor(private readonly legacyStore: PluginDataStore) {}

  async rollback(contestId: string): Promise<MigrationReceipt> {
    const legacy = await this.legacyStore.load();
    const receipt = [...legacy.runtimeState!.migrationReceipts]
      .reverse()
      .find((candidate) => candidate.contestId === contestId && candidate.status === "activated");
    if (!receipt || legacy.runtimeState!.contestStorage[contestId] !== "vault-markdown") {
      throw new Error(`Contest "${contestId}" is not using Markdown authority.`);
    }
    if ((await this.safety.checksum(legacy, contestId)) !== receipt.sourceChecksum) {
      throw new Error(
        "The legacy JSON changed after activation. Rollback is blocked to prevent replacing newer data."
      );
    }

    const rolledBack: MigrationReceipt = { ...receipt, status: "rolled-back" };
    await this.legacyStore.mutate((data) => {
      data.runtimeState!.contestStorage[contestId] = "legacy-json";
      const index = data.runtimeState!.migrationReceipts.findIndex(
        (candidate) => candidate.id === receipt.id
      );
      data.runtimeState!.migrationReceipts[index] = rolledBack;
    });
    return rolledBack;
  }
}
