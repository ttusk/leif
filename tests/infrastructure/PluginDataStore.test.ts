import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";

class InMemoryStorageAdapter implements PersistentStorageAdapter<LeifPluginData> {
  private data: LeifPluginData | null;

  constructor(initialData: LeifPluginData | null = null) {
    this.data = initialData;
  }

  async load(): Promise<LeifPluginData | null> {
    return this.data;
  }

  async save(data: LeifPluginData): Promise<void> {
    this.data = data;
  }
}

class DelayedStorageAdapter extends InMemoryStorageAdapter {
  override async save(data: LeifPluginData): Promise<void> {
    await Promise.resolve();
    await super.save(structuredClone(data));
  }
}

describe("PluginDataStore", () => {
  it("loads default data when there is no persisted state", async () => {
    const store = new PluginDataStore(new InMemoryStorageAdapter());

    await expect(store.load()).resolves.toEqual(createDefaultLeifPluginData());
  });

  it("persists and reloads contests and cycle order", async () => {
    const adapter = new InMemoryStorageAdapter();
    const store = new PluginDataStore(adapter);
    const initialData: LeifPluginData = {
      ...createDefaultLeifPluginData(),
      activeContestId: "contest-1",
      contests: [
        {
          id: "contest-1",
          name: "TRT",
          subjectIds: ["subject-2", "subject-1"],
          wall: {
            noticeLinks: [],
            examLinks: [],
            subjectSnapshots: []
          }
        }
      ],
      contestStates: [
        {
          contestId: "contest-1",
          currentSubjectId: "subject-2",
          currentItemId: null
        }
      ],
      subjects: [
        {
          id: "subject-2",
          contestId: "contest-1",
          name: "Direito Constitucional",
          order: 1,
          isActive: true,
          plannedStudyMinutes: 45,
          itemIds: [],
          topicIds: []
        },
        {
          id: "subject-1",
          contestId: "contest-1",
          name: "Portuguese",
          order: 2,
          isActive: true,
          plannedStudyMinutes: 60,
          itemIds: [],
          topicIds: []
        }
      ]
    };

    await store.save(initialData);

    await expect(store.load()).resolves.toEqual(initialData);
  });

  it("serializes concurrent mutations without losing either update", async () => {
    const store = new PluginDataStore(new DelayedStorageAdapter(createDefaultLeifPluginData()));

    await Promise.all([
      store.mutate((data) => {
        data.activeContestId = "contest-1";
      }),
      store.mutate((data) => {
        data.contestStates.push({
          contestId: "contest-1",
          currentSubjectId: null,
          currentItemId: null
        });
      })
    ]);

    const saved = await store.load();
    expect(saved.activeContestId).toBe("contest-1");
    expect(saved.contestStates).toHaveLength(1);
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
