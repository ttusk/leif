import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { ActiveContestGuard } from "@/application/guards/ActiveContestGuard";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { NoActiveContestError } from "@/domain/errors/DomainErrors";

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

function createStore(): PluginDataStore {
  return new PluginDataStore(new InMemoryStorageAdapter(createDefaultLeifPluginData()));
}

describe("ActiveContestGuard", () => {
  it("returns the active contest id when one exists", async () => {
    const store = createStore();
    const data = await store.load();
    await store.save({
      ...data,
      activeContestId: "contest-1",
      contests: [
        {
          id: "contest-1",
          name: "TRT",
          subjectIds: [],
          wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
        }
      ]
    });

    const guard = new ActiveContestGuard(store);
    const activeId = await guard.requireActiveContest();
    expect(activeId).toBe("contest-1");
  });

  it("throws NoActiveContestError when no active contest exists", async () => {
    const store = createStore();
    const guard = new ActiveContestGuard(store);

    await expect(guard.requireActiveContest()).rejects.toThrow(NoActiveContestError);
  });

  it("returns subjects for the active contest sorted by order", async () => {
    const store = createStore();
    const data = await store.load();
    await store.save({
      ...data,
      activeContestId: "contest-1",
      contests: [
        {
          id: "contest-1",
          name: "TRT",
          subjectIds: [],
          wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
        }
      ],
      subjects: [
        {
          id: "sub-2",
          contestId: "contest-1",
          name: "Constitutional",
          order: 2,
          isActive: true,
          plannedStudyMinutes: 45,
          itemIds: [],
          topicIds: []
        },
        {
          id: "sub-1",
          contestId: "contest-1",
          name: "Portuguese",
          order: 1,
          isActive: true,
          plannedStudyMinutes: 60,
          itemIds: [],
          topicIds: []
        },
        {
          id: "sub-3",
          contestId: "contest-2",
          name: "Tax",
          order: 1,
          isActive: true,
          plannedStudyMinutes: 30,
          itemIds: [],
          topicIds: []
        }
      ]
    });

    const guard = new ActiveContestGuard(store);
    const subjects = await guard.getActiveContestSubjects();
    expect(subjects).toHaveLength(2);
    expect(subjects[0].id).toBe("sub-1");
    expect(subjects[1].id).toBe("sub-2");
  });

  it("returns only active subjects", async () => {
    const store = createStore();
    const data = await store.load();
    await store.save({
      ...data,
      activeContestId: "contest-1",
      contests: [
        {
          id: "contest-1",
          name: "TRT",
          subjectIds: [],
          wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
        }
      ],
      subjects: [
        {
          id: "sub-1",
          contestId: "contest-1",
          name: "Portuguese",
          order: 1,
          isActive: true,
          plannedStudyMinutes: 60,
          itemIds: [],
          topicIds: []
        },
        {
          id: "sub-2",
          contestId: "contest-1",
          name: "Constitutional",
          order: 2,
          isActive: false,
          plannedStudyMinutes: 45,
          itemIds: [],
          topicIds: []
        }
      ]
    });

    const guard = new ActiveContestGuard(store);
    const activeSubjects = await guard.getActiveSubjects();
    expect(activeSubjects).toHaveLength(1);
    expect(activeSubjects[0].id).toBe("sub-1");
  });
});
