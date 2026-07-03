import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { ListSubjectsForActiveContestUseCase } from "@/application/use-cases/ListSubjectsForActiveContestUseCase";
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";

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

describe("Contest management", () => {
  it("sets the first created contest as active and keeps it active when adding another contest", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createContest.execute({ id: "contest-2", name: "SEFAZ" });

    const data = await store.load();

    expect(data.activeContestId).toBe("contest-1");
    expect(data.contests.map((contest) => contest.id)).toEqual(["contest-1", "contest-2"]);
    expect(data.contestStates).toEqual([
      { contestId: "contest-1", currentSubjectId: null, currentItemId: null },
      { contestId: "contest-2", currentSubjectId: null, currentItemId: null }
    ]);
  });

  it("switches the active contest without mixing subjects from other contests", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const setActiveContest = new SetActiveContestUseCase(store, factory);
    const listSubjects = new ListSubjectsForActiveContestUseCase(store);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createContest.execute({ id: "contest-2", name: "SEFAZ" });

    await createSubject.execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Portuguese",
      plannedStudyMinutes: 60
    });
    await createSubject.execute({
      id: "subject-2",
      contestId: "contest-2",
      name: "Tax Law",
      plannedStudyMinutes: 45
    });

    await setActiveContest.execute({ contestId: "contest-2" });

    await expect(listSubjects.execute()).resolves.toMatchObject([{ id: "subject-2", contestId: "contest-2" }]);
  });
});
