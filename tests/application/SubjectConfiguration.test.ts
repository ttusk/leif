import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { ListSubjectsForActiveContestUseCase } from "@/application/use-cases/ListSubjectsForActiveContestUseCase";
import { ReorderSubjectsUseCase } from "@/application/use-cases/ReorderSubjectsUseCase";
import { UpdateSubjectConfigurationUseCase } from "@/application/use-cases/UpdateSubjectConfigurationUseCase";
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

describe("Subject configuration", () => {
  it("reorders subjects and updates planned study time and stage", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const reorderSubjects = new ReorderSubjectsUseCase(store, factory);
    const updateSubjectConfiguration = new UpdateSubjectConfigurationUseCase(store, factory);
    const listSubjects = new ListSubjectsForActiveContestUseCase(store);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createSubject.execute({ id: "subject-1", contestId: "contest-1", name: "Portuguese", plannedStudyMinutes: 60 });
    await createSubject.execute({ id: "subject-2", contestId: "contest-1", name: "Constitutional Law", plannedStudyMinutes: 45 });
    await createSubject.execute({ id: "subject-3", contestId: "contest-1", name: "Administrative Law", plannedStudyMinutes: 30 });

    await reorderSubjects.execute({
      contestId: "contest-1",
      subjectIdsInOrder: ["subject-3", "subject-1", "subject-2"]
    });
    await updateSubjectConfiguration.execute({
      subjectId: "subject-1",
      plannedStudyMinutes: 90,
      currentStage: "Questions"
    });

    await expect(listSubjects.execute()).resolves.toMatchObject([
      { id: "subject-3", order: 1 },
      { id: "subject-1", order: 2, plannedStudyMinutes: 90, currentStage: "Questions" },
      { id: "subject-2", order: 3 }
    ]);
  });
});
