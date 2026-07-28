import { describe, expect, it } from "vitest";

import { CycleState } from "@/domain/entities/CycleState";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { InMemoryStorageAdapter } from "../helpers/InMemoryStore";

class DelayedStorageAdapter extends InMemoryStorageAdapter {
  override async save(data: LeifPluginData): Promise<void> {
    await Promise.resolve();
    await super.save(data);
  }
}

describe("PluginDataStore", () => {
  it("loads default schema-3 data when there is no persisted state", async () => {
    const store = new PluginDataStore(new InMemoryStorageAdapter(null));

    await expect(store.load()).resolves.toEqual(createDefaultLeifPluginData());
  });

  it("persists and reloads schema-3 collections", async () => {
    const store = new PluginDataStore(new InMemoryStorageAdapter(null));
    const data = {
      ...createDefaultLeifPluginData(),
      activeContestId: "contest-1",
      contests: [{ id: "contest-1", name: "TRT", subjectIds: [], mural: { snapshots: [] } }],
      cycleStates: [new CycleState("contest-1", "subject-1", "resource-1")]
    };

    await store.save(data);

    await expect(store.load()).resolves.toEqual(data);
  });

  it("serializes concurrent mutations without losing either update", async () => {
    const store = new PluginDataStore(new DelayedStorageAdapter(createDefaultLeifPluginData()));

    await Promise.all([
      store.mutate((data) => {
        data.activeContestId = "contest-1";
      }),
      store.mutate((data) => {
        data.cycleStates.push(new CycleState("contest-1"));
      })
    ]);

    const saved = await store.load();
    expect(saved.activeContestId).toBe("contest-1");
    expect(saved.cycleStates).toHaveLength(1);
  });

  it("does not persist a partially mutated draft when the transaction fails", async () => {
    const store = new PluginDataStore(new InMemoryStorageAdapter(createDefaultLeifPluginData()));

    await expect(
      store.mutate((data) => {
        data.activeContestId = "partial";
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect((await store.load()).activeContestId).toBeNull();
  });
});
