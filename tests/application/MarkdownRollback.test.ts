import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { MarkdownRollbackService } from "@/application/services/MarkdownRollbackService";
import { MigrationSafetyService } from "@/application/services/MigrationSafetyService";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";

class MemoryAdapter implements PersistentStorageAdapter<LeifPluginData> {
  constructor(private data: LeifPluginData) {}
  async load(): Promise<LeifPluginData> {
    return structuredClone(this.data);
  }
  async save(data: LeifPluginData): Promise<void> {
    this.data = structuredClone(data);
  }
}

async function activatedData(): Promise<LeifPluginData> {
  const data = createDefaultLeifPluginData();
  data.contests.push({
    id: "contest-1",
    name: "TRT",
    subjectIds: [],
    wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
  });
  const prepared = await new MigrationSafetyService().prepare(
    data,
    "contest-1",
    "Leif/.backups/contest-1.json",
    "2026-07-21T20:00:00Z"
  );
  data.runtimeState!.contestStorage["contest-1"] = "vault-markdown";
  data.runtimeState!.migrationReceipts.push({
    ...prepared.receipt,
    status: "activated",
    targetChecksum: prepared.receipt.sourceChecksum,
    activatedAt: "2026-07-21T20:01:00Z"
  });
  return data;
}

describe("MarkdownRollbackService", () => {
  it("returns authority to unchanged legacy JSON while retaining the migration record", async () => {
    const store = new PluginDataStore(new MemoryAdapter(await activatedData()));
    const receipt = await new MarkdownRollbackService(store).rollback("contest-1");

    expect(receipt.status).toBe("rolled-back");
    const saved = await store.load();
    expect(saved.runtimeState?.contestStorage["contest-1"]).toBe("legacy-json");
  });

  it("blocks rollback when a downgrade or sync changed the legacy snapshot", async () => {
    const data = await activatedData();
    data.contests[0] = { ...data.contests[0], name: "Changed by downgrade" };
    const store = new PluginDataStore(new MemoryAdapter(data));

    await expect(new MarkdownRollbackService(store).rollback("contest-1")).rejects.toThrow(
      /legacy JSON changed/i
    );
    expect((await store.load()).runtimeState?.contestStorage["contest-1"]).toBe("vault-markdown");
  });
});
