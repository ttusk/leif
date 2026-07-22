import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { RegisterRecommendedStudySessionUseCase } from "@/application/use-cases/RegisterRecommendedStudySessionUseCase";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";

class RecordingStorageAdapter implements PersistentStorageAdapter<LeifPluginData> {
  saveCount = 0;

  constructor(private data: LeifPluginData | null = null) {}

  async load(): Promise<LeifPluginData | null> {
    return this.data;
  }

  async save(data: LeifPluginData): Promise<void> {
    this.saveCount += 1;
    this.data = structuredClone(data);
  }

  resetSaveCount(): void {
    this.saveCount = 0;
  }
}

interface SeededRecommendedCycle {
  store: PluginDataStore;
  adapter: RecordingStorageAdapter;
}

async function seedRecommendedCycle(): Promise<SeededRecommendedCycle> {
  const adapter = new RecordingStorageAdapter(createDefaultLeifPluginData());
  const store = new PluginDataStore(adapter);
  const factory = new EntityRepositoryFactory(store);
  const createContest = new CreateContestUseCase(store, factory);
  const createSubject = new CreateSubjectUseCase(store, factory);
  const createStudyItem = new CreateStudyItemUseCase(store, factory);

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
  await createStudyItem.execute({
    id: "item-1",
    subjectId: "subject-1",
    title: "Sintaxe",
    totalPages: 10
  });
  await createStudyItem.execute({
    id: "item-2",
    subjectId: "subject-2",
    title: "Controle de constitucionalidade",
    totalPages: 10
  });
  await store.mutate((data) => {
    const state = data.contestStates.find((candidate) => candidate.contestId === "contest-1");
    if (!state) throw new Error("Expected seeded contest state.");
    state.currentSubjectId = "subject-1";
    state.currentItemId = "item-1";
  });

  adapter.resetSaveCount();
  return { store, adapter };
}

describe("RegisterRecommendedStudySessionUseCase", () => {
  it("atomically registers a completed recommended session and advances to the next position", async () => {
    const { store, adapter } = await seedRecommendedCycle();
    const useCase = new RegisterRecommendedStudySessionUseCase(store);

    const result = await useCase.execute({
      id: "session-recommended",
      contestId: "contest-1",
      subjectId: "subject-1",
      studyItemId: "item-1",
      type: "pdf",
      studiedAt: "2026-07-21T20:00:00.000Z",
      pagesOrCount: 10,
      completed: true
    });

    expect(result).toEqual({
      session: expect.objectContaining({ id: "session-recommended", completed: true }),
      cycleAdvanced: true,
      previousPosition: { subjectId: "subject-1", itemId: "item-1" },
      newPosition: { subjectId: "subject-2", itemId: "item-2" }
    });
    expect(adapter.saveCount).toBe(1);

    const saved = await store.load();
    expect(saved.studySessions.map((session) => session.id)).toContain("session-recommended");
    expect(saved.contestStates).toContainEqual({
      contestId: "contest-1",
      currentSubjectId: "subject-2",
      currentItemId: "item-2"
    });
  });

  it("registers a completed manual session without advancing a different recommendation", async () => {
    const { store, adapter } = await seedRecommendedCycle();
    const useCase = new RegisterRecommendedStudySessionUseCase(store);

    const result = await useCase.execute({
      id: "session-manual",
      contestId: "contest-1",
      subjectId: "subject-2",
      studyItemId: "item-2",
      type: "pdf",
      studiedAt: "2026-07-21T20:00:00.000Z",
      pagesOrCount: 10,
      completed: true
    });

    expect(result).toEqual({
      session: expect.objectContaining({ id: "session-manual", completed: true }),
      cycleAdvanced: false,
      previousPosition: { subjectId: "subject-1", itemId: "item-1" },
      newPosition: { subjectId: "subject-1", itemId: "item-1" }
    });
    expect(adapter.saveCount).toBe(1);

    const saved = await store.load();
    expect(saved.studySessions.map((session) => session.id)).toContain("session-manual");
    expect(saved.contestStates).toContainEqual({
      contestId: "contest-1",
      currentSubjectId: "subject-1",
      currentItemId: "item-1"
    });
  });

  it("rolls back the session and cycle position when validation fails", async () => {
    const { store, adapter } = await seedRecommendedCycle();
    const useCase = new RegisterRecommendedStudySessionUseCase(store);
    const before = structuredClone(await store.load());

    await expect(
      useCase.execute({
        id: "session-invalid",
        contestId: "contest-1",
        subjectId: "subject-1",
        studyItemId: "item-1",
        type: "questions",
        studiedAt: "2026-07-21T20:00:00.000Z",
        pagesOrCount: 5,
        correctAnswers: 8,
        completed: true
      })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(adapter.saveCount).toBe(0);
    expect(await store.load()).toEqual(before);
  });
});
