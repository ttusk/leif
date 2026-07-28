import { beforeEach, describe, expect, it } from "vitest";
import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateResourceUseCase } from "@/application/use-cases/CreateResourceUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { DeleteStudyRecordUseCase } from "@/application/use-cases/DeleteStudyRecordUseCase";
import { RegisterStudyRecordsUseCase } from "@/application/use-cases/RegisterStudyRecordsUseCase";
import { UpdateStudyRecordUseCase } from "@/application/use-cases/UpdateStudyRecordUseCase";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import { GoalUnit } from "@/domain/types/GoalUnit";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";

class RecordingStorageAdapter implements PersistentStorageAdapter<LeifPluginData> {
  saveCount = 0;

  constructor(private data: LeifPluginData = createDefaultLeifPluginData()) {}

  async load(): Promise<LeifPluginData> {
    return structuredClone(this.data);
  }

  async save(data: LeifPluginData): Promise<void> {
    this.saveCount += 1;
    this.data = structuredClone(data);
  }
}

describe("independent study record use cases", () => {
  let adapter: RecordingStorageAdapter;
  let store: PluginDataStore;

  beforeEach(async () => {
    adapter = new RecordingStorageAdapter();
    store = new PluginDataStore(adapter);
    const factory = new EntityRepositoryFactory(store);
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
    await new CreateResourceUseCase(store, factory).execute({
      id: "resource-a1",
      subjectId: subjectA.id,
      title: "Aula 01"
    });
    await new CreateResourceUseCase(store, factory).execute({
      id: "resource-b1",
      subjectId: subjectB.id,
      title: "PDF 01"
    });
    adapter.saveCount = 0;
  });

  it("persists one or many dated records independently in one atomic save", async () => {
    const beforeCycle = structuredClone((await store.load()).cycleStates);

    const result = await new RegisterStudyRecordsUseCase(store).execute({
      contestId: "contest-1",
      date: "2026-07-27",
      records: [
        {
          id: "record-1",
          subjectId: "subject-a",
          quantity: 30,
          unit: GoalUnit.PAGINAS
        },
        {
          id: "record-2",
          subjectId: "subject-b",
          resourceId: "resource-b1",
          quantity: 20,
          unit: GoalUnit.QUESTOES,
          correctAnswers: 15,
          completed: true
        }
      ]
    });

    expect(result.records.map((record) => record.id)).toEqual(["record-1", "record-2"]);
    expect((await store.load()).studyRecords).toMatchObject([
      { id: "record-1", contestId: "contest-1", date: "2026-07-27" },
      { id: "record-2", contestId: "contest-1", date: "2026-07-27" }
    ]);
    expect((await store.load()).cycleStates).toEqual(beforeCycle);
    expect(adapter.saveCount).toBe(1);
  });

  it("rejects empty batches, duplicate IDs and cross-subject relations", async () => {
    const register = new RegisterStudyRecordsUseCase(store);
    await expect(
      register.execute({ contestId: "contest-1", date: "2026-07-27", records: [] })
    ).rejects.toThrow(ValidationError);
    await expect(
      register.execute({
        contestId: "contest-1",
        date: "2026-07-27",
        records: [
          { id: "duplicate", subjectId: "subject-a" },
          { id: "duplicate", subjectId: "subject-a" }
        ]
      })
    ).rejects.toThrow();
    await expect(
      register.execute({
        contestId: "contest-1",
        date: "2026-07-27",
        records: [{ subjectId: "subject-b", resourceId: "resource-a1" }]
      })
    ).rejects.toThrow(ValidationError);
  });

  it("updates and deletes exactly one record", async () => {
    const register = new RegisterStudyRecordsUseCase(store);
    await register.execute({
      contestId: "contest-1",
      date: "2026-07-27",
      records: [
        { id: "record-1", subjectId: "subject-a" },
        { id: "record-2", subjectId: "subject-b" }
      ]
    });

    const updated = await new UpdateStudyRecordUseCase(store).execute({
      recordId: "record-1",
      date: "2026-07-28",
      quantity: 12,
      unit: GoalUnit.QUESTOES,
      correctAnswers: 10
    });
    expect(updated).toMatchObject({
      id: "record-1",
      date: "2026-07-28",
      quantity: 12,
      correctAnswers: 10
    });
    expect(
      (await store.load()).studyRecords.find((record) => record.id === "record-2")
    ).toBeTruthy();

    await new DeleteStudyRecordUseCase(store).execute({ recordId: "record-1" });
    expect((await store.load()).studyRecords.map((record) => record.id)).toEqual(["record-2"]);
    await expect(
      new DeleteStudyRecordUseCase(store).execute({ recordId: "missing" })
    ).rejects.toThrow(NotFoundError);
  });
});
