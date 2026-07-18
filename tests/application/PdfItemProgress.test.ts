import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { GetActiveContestProgressDashboardUseCase } from "@/application/use-cases/GetActiveContestProgressDashboardUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { UpdateStudyItemUseCase } from "@/application/use-cases/UpdateStudyItemUseCase";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { seedMinimalContest } from "../fixtures/seedMinimalContest";

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

describe("GetActiveContestProgressDashboardUseCase - PDF completion", () => {
  it("updates a study item title", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const { subjectId } = await seedMinimalContest(store);
    const createItem = new CreateStudyItemUseCase(store, factory);
    const updateItem = new UpdateStudyItemUseCase(store, factory);

    const item = await createItem.execute({ subjectId, title: "Sintaxe" });

    await expect(
      updateItem.execute({ itemId: item.id, title: "Concordância" })
    ).resolves.toMatchObject({
      id: item.id,
      title: "Concordância"
    });
  });

  it("reports pagesReaded, totalPages and completed flag per item", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const { subjectId } = await seedMinimalContest(store);
    const createItem = new CreateStudyItemUseCase(store, factory);
    const updateItem = new UpdateStudyItemUseCase(store, factory);
    const dashboard = new GetActiveContestProgressDashboardUseCase(store);

    const item1 = await createItem.execute({ subjectId, title: "Sintaxe" });
    await updateItem.execute({ itemId: item1.id, totalPages: 100 });

    const item2 = await createItem.execute({ subjectId, title: "Pontuação" });
    await updateItem.execute({ itemId: item2.id, totalPages: 50 });

    const result = await dashboard.execute();
    const items = result.pdfProgressBySubject[0]?.items ?? [];

    const item1Entry = items.find((entry) => entry.studyItemId === item1.id);
    const item2Entry = items.find((entry) => entry.studyItemId === item2.id);

    expect(item1Entry).toMatchObject({
      pagesReaded: 0,
      totalPages: 100,
      completed: false
    });
    expect(item2Entry).toMatchObject({
      pagesReaded: 0,
      totalPages: 50,
      completed: false
    });
  });

  it("marks an item as completed once pagesReaded meets totalPages", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const { contestId, subjectId } = await seedMinimalContest(store);
    const createItem = new CreateStudyItemUseCase(store, factory);
    const updateItem = new UpdateStudyItemUseCase(store, factory);
    const registerSession = new RegisterStudySessionUseCase(store, factory);
    const dashboard = new GetActiveContestProgressDashboardUseCase(store);

    const item1 = await createItem.execute({ subjectId, title: "Sintaxe" });
    await updateItem.execute({ itemId: item1.id, totalPages: 100 });

    await registerSession.execute({
      id: "session-1",
      contestId,
      subjectId,
      studyItemId: item1.id,
      type: "pdf",
      studiedAt: "2026-06-11T20:00:00.000Z",
      pagesOrCount: 100,
      completed: true
    });

    const result = await dashboard.execute();
    const item1Entry = result.pdfProgressBySubject[0]?.items.find(
      (entry) => entry.studyItemId === item1.id
    );

    expect(item1Entry).toMatchObject({
      pagesReaded: 100,
      totalPages: 100,
      completed: true
    });
  });

  it("leaves completed false when an item has no totalPages", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const { contestId, subjectId } = await seedMinimalContest(store);
    const createItem = new CreateStudyItemUseCase(store, factory);
    const registerSession = new RegisterStudySessionUseCase(store, factory);
    const dashboard = new GetActiveContestProgressDashboardUseCase(store);

    const item1 = await createItem.execute({ subjectId, title: "Sintaxe" });

    await registerSession.execute({
      id: "session-1",
      contestId,
      subjectId,
      studyItemId: item1.id,
      type: "pdf",
      studiedAt: "2026-06-11T20:00:00.000Z",
      pagesOrCount: 30,
      completed: true
    });

    const result = await dashboard.execute();
    const item1Entry = result.pdfProgressBySubject[0]?.items.find(
      (entry) => entry.studyItemId === item1.id
    );

    expect(item1Entry).toMatchObject({
      pagesReaded: 30,
      totalPages: undefined,
      completed: false
    });
  });
});
