import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { AdvanceCycleUseCase } from "@/application/use-cases/AdvanceCycleUseCase";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { SetSubjectActiveStateUseCase } from "@/application/use-cases/SetSubjectActiveStateUseCase";
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

describe("AdvanceCycleUseCase", () => {
  it("persists the next active subject for the active contest and skips inactive subjects", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const setSubjectActiveState = new SetSubjectActiveStateUseCase(store, factory);
    const advanceCycle = new AdvanceCycleUseCase(store);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createSubject.execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Portuguese",
      plannedStudyMinutes: 60
    });
    await createSubject.execute({
      id: "subject-2",
      contestId: "contest-1",
      name: "Constitutional Law",
      plannedStudyMinutes: 45
    });
    await createSubject.execute({
      id: "subject-3",
      contestId: "contest-1",
      name: "Administrative Law",
      plannedStudyMinutes: 30
    });

    await setSubjectActiveState.execute({ subjectId: "subject-2", isActive: false });

    await expect(advanceCycle.execute()).resolves.toMatchObject({ currentSubjectId: "subject-1" });
    await expect(advanceCycle.execute()).resolves.toMatchObject({ currentSubjectId: "subject-3" });
    await expect(advanceCycle.execute()).resolves.toMatchObject({ currentSubjectId: "subject-1" });
  });

  it("returns the new current subject and the next upcoming subject", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const advanceCycle = new AdvanceCycleUseCase(store);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createSubject.execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Portuguese",
      plannedStudyMinutes: 60
    });
    await createSubject.execute({
      id: "subject-2",
      contestId: "contest-1",
      name: "Constitutional Law",
      plannedStudyMinutes: 45
    });

    const result = await advanceCycle.execute();

    expect(result).toMatchObject({
      currentSubjectId: "subject-1",
      currentSubject: { id: "subject-1", name: "Portuguese" },
      nextSubject: { id: "subject-2", name: "Constitutional Law" }
    });
  });

  it("calculates the upcoming subject item from that subject progress", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const createStudyItem = new CreateStudyItemUseCase(store, factory);
    const registerStudySession = new RegisterStudySessionUseCase(store, factory);
    const advanceCycle = new AdvanceCycleUseCase(store);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createSubject.execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Portuguese",
      plannedStudyMinutes: 60
    });
    await createSubject.execute({
      id: "subject-2",
      contestId: "contest-1",
      name: "Constitutional Law",
      plannedStudyMinutes: 45
    });

    const completedCurrentSubjectItem = await createStudyItem.execute({ subjectId: "subject-1", title: "Sintaxe", totalPages: 10 });
    const upcomingSubjectItem = await createStudyItem.execute({ subjectId: "subject-2", title: "Controle de constitucionalidade" });

    await registerStudySession.execute({
      id: "session-1",
      contestId: "contest-1",
      subjectId: "subject-1",
      studyItemId: completedCurrentSubjectItem.id,
      type: "pdf",
      studiedAt: "2026-06-11T20:00:00.000Z",
      pagesOrCount: 10,
      completed: true
    });

    await expect(advanceCycle.execute()).resolves.toMatchObject({
      currentSubject: { id: "subject-1" },
      nextSubject: { id: "subject-2" },
      currentItemId: null,
      nextItemId: upcomingSubjectItem.id
    });
  });
});
