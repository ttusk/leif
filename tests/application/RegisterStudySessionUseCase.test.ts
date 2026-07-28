import { beforeEach, describe, expect, it } from "vitest";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateResourceUseCase } from "@/application/use-cases/CreateResourceUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { GoalUnit } from "@/domain/types/GoalUnit";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

class InMemoryStorageAdapter implements PersistentStorageAdapter<LeifPluginData> {
  private data: LeifPluginData | null;

  constructor(initialData: LeifPluginData | null = null) {
    this.data = initialData ? structuredClone(initialData) : null;
  }

  async load(): Promise<LeifPluginData | null> {
    return this.data ? structuredClone(this.data) : null;
  }

  async save(data: LeifPluginData): Promise<void> {
    this.data = structuredClone(data);
  }
}

class RecordingStorageAdapter extends InMemoryStorageAdapter {
  saveCount = 0;

  override async save(data: LeifPluginData): Promise<void> {
    this.saveCount += 1;
    await super.save(data);
  }

  resetSaveCount(): void {
    this.saveCount = 0;
  }
}

describe("RegisterStudySessionUseCase", () => {
  let adapter: RecordingStorageAdapter;
  let store: PluginDataStore;
  let factory: EntityRepositoryFactory;
  let useCase: RegisterStudySessionUseCase;

  const seedContestWithResources = async () => {
    const contest = await new CreateContestUseCase(store, factory).execute({
      id: "contest-1",
      name: "TRT"
    });
    const subjectA = await new CreateSubjectUseCase(store, factory).execute({
      id: "subject-a",
      contestId: contest.id,
      name: "Português",
      plannedStudyMinutes: 60
    });
    const subjectB = await new CreateSubjectUseCase(store, factory).execute({
      id: "subject-b",
      contestId: contest.id,
      name: "Direito",
      plannedStudyMinutes: 45
    });
    const resourceA1 = await new CreateResourceUseCase(store, factory).execute({
      id: "resource-a1",
      subjectId: subjectA.id,
      title: "Aula 01"
    });
    const resourceB1 = await new CreateResourceUseCase(store, factory).execute({
      id: "resource-b1",
      subjectId: subjectB.id,
      title: "PDF 01"
    });
    return { contest, subjectA, subjectB, resourceA1, resourceB1 };
  };

  beforeEach(async () => {
    adapter = new RecordingStorageAdapter(createDefaultLeifPluginData());
    store = new PluginDataStore(adapter);
    factory = new EntityRepositoryFactory(store);
    useCase = new RegisterStudySessionUseCase(store, factory);
    await seedContestWithResources();
    adapter.resetSaveCount();
  });

  it("persists a multi-record session atomically in one save", async () => {
    const result = await useCase.execute({
      contestId: "contest-1",
      date: "2026-07-27",
      startTime: "19:00",
      endTime: "21:00",
      records: [
        { subjectId: "subject-a", quantity: 30, unit: GoalUnit.PAGINAS },
        {
          subjectId: "subject-b",
          quantity: 20,
          unit: GoalUnit.QUESTOES,
          correctAnswers: 15
        }
      ]
    });

    expect(result.session.records).toHaveLength(2);
    expect(result.session.records[0].subjectId).toBe("subject-a");
    expect(result.session.records[1].correctAnswers).toBe(15);
    expect(result.session.records.every((record) => record.id.trim().length > 0)).toBe(true);
    expect(adapter.saveCount).toBe(1);

    const persisted = await store.load();
    expect(persisted.studySessions).toHaveLength(1);
    expect(persisted.studySessions[0].startTime).toBe("19:00");
  });

  it.each([
    [
      "one",
      [{ subjectId: "subject-a", resourceId: "resource-a1", completed: true }]
    ],
    [
      "many",
      [
        { subjectId: "subject-a", resourceId: "resource-a1", completed: true },
        { subjectId: "subject-b", resourceId: "resource-b1", completed: true }
      ]
    ]
  ])(
    "does not change cycle state when saving %s independent study records",
    async (_label, records) => {
      const before = structuredClone((await store.load()).cycleStates);

      await useCase.execute({
        contestId: "contest-1",
        date: "2026-07-27",
        records
      });

      expect((await store.load()).cycleStates).toEqual(before);
    }
  );

  it("rejects a session without records so empty sessions never persist", async () => {
    await expect(
      useCase.execute({ contestId: "contest-1", date: "2026-07-27", records: [] })
    ).rejects.toThrow(ValidationError);

    expect((await store.load()).studySessions).toHaveLength(0);
  });

  it("rejects records whose subject, resource or topic do not belong together", async () => {
    await expect(
      useCase.execute({
        contestId: "contest-1",
        date: "2026-07-27",
        records: [{ subjectId: "subject-b", resourceId: "resource-a1" }]
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      useCase.execute({
        contestId: "contest-1",
        date: "2026-07-27",
        records: [{ subjectId: "subject-a", topicId: "missing" }]
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      useCase.execute({
        contestId: "contest-1",
        date: "2026-07-27",
        records: [{ subjectId: "subject-x" }]
      })
    ).rejects.toThrow(NotFoundError);

    expect((await store.load()).studySessions).toHaveLength(0);
  });

  it("rejects duplicate session ids and unknown contests", async () => {
    await useCase.execute({
      id: "session-1",
      contestId: "contest-1",
      date: "2026-07-27",
      records: [{ subjectId: "subject-a" }]
    });

    await expect(
      useCase.execute({
        id: "session-1",
        contestId: "contest-1",
        date: "2026-07-28",
        records: [{ subjectId: "subject-a" }]
      })
    ).rejects.toThrow();

    await expect(
      useCase.execute({
        contestId: "missing",
        date: "2026-07-28",
        records: [{ subjectId: "subject-a" }]
      })
    ).rejects.toThrow(NotFoundError);
  });

});
