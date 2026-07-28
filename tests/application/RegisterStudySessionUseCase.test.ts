import { beforeEach, describe, expect, it } from "vitest";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateResourceUseCase } from "@/application/use-cases/CreateResourceUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
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
        { subjectId: "subject-a", activity: "leitura", quantity: 30, unit: GoalUnit.PAGINAS },
        {
          subjectId: "subject-b",
          activity: "questoes",
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
        records: [{ subjectId: "subject-b", activity: "leitura", resourceId: "resource-a1" }]
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      useCase.execute({
        contestId: "contest-1",
        date: "2026-07-27",
        records: [{ subjectId: "subject-a", activity: "leitura", topicId: "missing" }]
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      useCase.execute({
        contestId: "contest-1",
        date: "2026-07-27",
        records: [{ subjectId: "subject-x", activity: "leitura" }]
      })
    ).rejects.toThrow(NotFoundError);

    expect((await store.load()).studySessions).toHaveLength(0);
  });

  it("advances through consecutive completed records in one mutation", async () => {
    const result = await useCase.execute({
      contestId: "contest-1",
      date: "2026-07-27",
      records: [
        { subjectId: "subject-a", activity: "leitura", resourceId: "resource-a1", completed: true },
        { subjectId: "subject-b", activity: "leitura", resourceId: "resource-b1", completed: true }
      ]
    });

    expect(result.cycleAdvanced).toBe(true);
    expect(result.previousPosition).toEqual({ subjectId: "subject-a", resourceId: "resource-a1" });
    expect(result.newPosition).toEqual({ subjectId: "subject-a", resourceId: "resource-a1" });

    const state = (await store.load()).cycleStates.find((entry) => entry.contestId === "contest-1");
    // Two consecutive matches wrap the two-subject cycle back to subject-a.
    expect(state?.currentSubjectId).toBe("subject-a");
    expect(adapter.saveCount).toBe(1);
  });

  it("saves valid records but stops advancing at the first mismatch", async () => {
    const result = await useCase.execute({
      contestId: "contest-1",
      date: "2026-07-27",
      records: [
        { subjectId: "subject-a", activity: "leitura", resourceId: "resource-a1", completed: true },
        { subjectId: "subject-a", activity: "revisao", completed: true },
        { subjectId: "subject-b", activity: "leitura", resourceId: "resource-b1", completed: true }
      ]
    });

    expect(result.cycleAdvanced).toBe(true);
    expect(result.newPosition).toEqual({ subjectId: "subject-b", resourceId: "resource-b1" });

    const state = (await store.load()).cycleStates.find((entry) => entry.contestId === "contest-1");
    expect(state?.currentSubjectId).toBe("subject-b");
    expect((await store.load()).studySessions[0].records).toHaveLength(3);
  });

  it("does not advance when the record does not match the recommendation", async () => {
    const result = await useCase.execute({
      contestId: "contest-1",
      date: "2026-07-27",
      records: [
        { subjectId: "subject-b", activity: "leitura", resourceId: "resource-b1", completed: true }
      ]
    });

    expect(result.cycleAdvanced).toBe(false);
    expect(result.newPosition).toEqual(result.previousPosition);

    const state = (await store.load()).cycleStates.find((entry) => entry.contestId === "contest-1");
    expect(state?.currentSubjectId).toBe("subject-a");
  });

  it("does not advance the cycle of a contest that is not active", async () => {
    await new CreateContestUseCase(store, factory).execute({ id: "contest-2", name: "SEFAZ" });
    await new CreateSubjectUseCase(store, factory).execute({
      id: "subject-c",
      contestId: "contest-2",
      name: "Raciocínio",
      plannedStudyMinutes: 30
    });

    const result = await useCase.execute({
      contestId: "contest-2",
      date: "2026-07-27",
      records: [{ subjectId: "subject-c", activity: "leitura", completed: true }]
    });

    expect(result.cycleAdvanced).toBe(false);
    const state = (await store.load()).cycleStates.find((entry) => entry.contestId === "contest-2");
    expect(state?.currentSubjectId).toBeNull();
  });

  it("rejects duplicate session ids and unknown contests", async () => {
    await useCase.execute({
      id: "session-1",
      contestId: "contest-1",
      date: "2026-07-27",
      records: [{ subjectId: "subject-a", activity: "leitura" }]
    });

    await expect(
      useCase.execute({
        id: "session-1",
        contestId: "contest-1",
        date: "2026-07-28",
        records: [{ subjectId: "subject-a", activity: "leitura" }]
      })
    ).rejects.toThrow();

    await expect(
      useCase.execute({
        contestId: "missing",
        date: "2026-07-28",
        records: [{ subjectId: "subject-a", activity: "leitura" }]
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("recommends the next incomplete resource after a goal is met mid-session", async () => {
    const factoryStore = new EntityRepositoryFactory(store);
    await new CreateResourceUseCase(store, factoryStore).execute({
      id: "resource-a2",
      subjectId: "subject-a",
      title: "Aula 02",
      goal: new ResourceGoal(30, GoalUnit.PAGINAS)
    });
    // Reorder so resource-a2 comes first and carries a goal met by this session.
    await store.mutate((draft) => {
      const subject = draft.subjects.find((entry) => entry.id === "subject-a");
      if (!subject) throw new Error("missing subject");
      subject.resourceIds.splice(0, subject.resourceIds.length, "resource-a2", "resource-a1");
    });

    const result = await useCase.execute({
      contestId: "contest-1",
      date: "2026-07-27",
      records: [
        {
          subjectId: "subject-a",
          activity: "leitura",
          resourceId: "resource-a2",
          quantity: 30,
          unit: GoalUnit.PAGINAS,
          completed: true
        }
      ]
    });

    expect(result.cycleAdvanced).toBe(true);
    expect(result.newPosition).toEqual({ subjectId: "subject-b", resourceId: "resource-b1" });
  });
});
