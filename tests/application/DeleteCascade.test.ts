import { describe, expect, it } from "vitest";

import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateResourceUseCase } from "@/application/use-cases/CreateResourceUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { DeleteResourceUseCase } from "@/application/use-cases/DeleteResourceUseCase";
import { DeleteStudyRecordUseCase } from "@/application/use-cases/DeleteStudyRecordUseCase";
import { DeleteTopicUseCase } from "@/application/use-cases/DeleteTopicUseCase";
import { RegisterStudyRecordsUseCase } from "@/application/use-cases/RegisterStudyRecordsUseCase";
import { Resource } from "@/domain/entities/Resource";
import { Subject } from "@/domain/entities/Subject";
import { NotFoundError } from "@/domain/errors/DomainErrors";
import { createTestStore } from "../helpers/InMemoryStore";

describe("delete cascades", () => {
  it("removes resources from subject ordering", async () => {
    const { store, factory } = createTestStore();
    await new CreateContestUseCase(store, factory).execute({ id: "contest-1", name: "TRT" });
    await new CreateSubjectUseCase(store, factory).execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Português",
      plannedStudyMinutes: 60
    });
    await new CreateResourceUseCase(store, factory).execute({
      id: "resource-1",
      subjectId: "subject-1",
      title: "PDF 01"
    });

    await new DeleteResourceUseCase(store, factory).execute({ resourceId: "resource-1" });

    expect((await store.load()).resources).toHaveLength(0);
    expect((await store.load()).subjects[0].resourceIds).toEqual([]);
    await expect(
      new DeleteResourceUseCase(store, factory).execute({ resourceId: "missing" })
    ).rejects.toThrow(NotFoundError);
  });

  it("deletes study records without touching study structure", async () => {
    const { store, factory } = createTestStore();
    await new CreateContestUseCase(store, factory).execute({ id: "contest-1", name: "TRT" });
    await new CreateSubjectUseCase(store, factory).execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Português",
      plannedStudyMinutes: 60
    });
    await new RegisterStudyRecordsUseCase(store).execute({
      contestId: "contest-1",
      date: "2026-07-27",
      records: [{ id: "record-1", subjectId: "subject-1" }]
    });

    await new DeleteStudyRecordUseCase(store).execute({ recordId: "record-1" });

    expect((await store.load()).studyRecords).toHaveLength(0);
    expect((await store.load()).subjects).toHaveLength(1);
  });

  it("removes topics from subject and resource references", async () => {
    const { store, factory } = createTestStore();
    await store.mutate((data) => {
      data.topics.push({ id: "topic-1", subjectId: "subject-1", name: "Concordância" });
      data.subjects.push(
        new Subject(
          "subject-1",
          "contest-1",
          "Português",
          1,
          true,
          60,
          undefined,
          ["resource-1"],
          ["topic-1"]
        )
      );
      data.resources.push(
        new Resource("resource-1", "subject-1", "PDF", 1, undefined, undefined, false, ["topic-1"])
      );
    });

    await new DeleteTopicUseCase(store, factory).execute({ topicId: "topic-1" });

    const data = await store.load();
    expect(data.subjects[0].topicIds).toEqual([]);
    expect(data.resources[0].topicIds).toEqual([]);
  });
});
