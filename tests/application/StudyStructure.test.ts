import { describe, expect, it } from "vitest";

import { AddResourceAccessUseCase } from "@/application/use-cases/AddResourceAccessUseCase";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateResourceUseCase } from "@/application/use-cases/CreateResourceUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { CreateTopicUseCase } from "@/application/use-cases/CreateTopicUseCase";
import { DeleteTopicUseCase } from "@/application/use-cases/DeleteTopicUseCase";
import { UpdateResourceUseCase } from "@/application/use-cases/UpdateResourceUseCase";
import { UpdateTopicUseCase } from "@/application/use-cases/UpdateTopicUseCase";
import { ResourceAccess } from "@/domain/entities/ResourceAccess";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { GoalUnit } from "@/domain/types/GoalUnit";
import { createTestStore } from "../helpers/InMemoryStore";

describe("study structure", () => {
  it("creates subjects, topics and resources in the new sibling hierarchy", async () => {
    const { store, factory } = createTestStore();
    await new CreateContestUseCase(store, factory).execute({ id: "contest-1", name: "TRT" });
    await new CreateSubjectUseCase(store, factory).execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Português",
      plannedStudyMinutes: 60
    });
    const topic = await new CreateTopicUseCase(store, factory).execute({
      id: "topic-1",
      subjectId: "subject-1",
      name: "Concordância"
    });
    const resource = await new CreateResourceUseCase(store, factory).execute({
      id: "resource-1",
      subjectId: "subject-1",
      title: "PDF 01",
      format: "pdf",
      goal: new ResourceGoal(80, GoalUnit.PAGINAS),
      topicIds: [topic.id],
      accesses: [new ResourceAccess("Arquivo", "vault://pdf-01")]
    });

    const data = await store.load();
    expect(resource.order).toBe(1);
    expect(data.subjects[0].topicIds).toEqual(["topic-1"]);
    expect(data.subjects[0].resourceIds).toEqual(["resource-1"]);
    expect(data.resources[0]).toMatchObject({
      id: "resource-1",
      goal: { amount: 80, unit: GoalUnit.PAGINAS },
      topicIds: ["topic-1"]
    });
  });

  it("updates resource details and appends accesses", async () => {
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

    await new UpdateResourceUseCase(store, factory).execute({
      resourceId: "resource-1",
      title: "PDF atualizado",
      completed: true
    });
    await new AddResourceAccessUseCase(store, factory).execute({
      resourceId: "resource-1",
      title: "Link",
      url: "https://example.com"
    });

    expect((await store.load()).resources[0]).toMatchObject({
      title: "PDF atualizado",
      completed: true,
      accesses: [{ title: "Link", url: "https://example.com" }]
    });
  });

  it("renames and deletes topics while stripping resource references", async () => {
    const { store, factory } = createTestStore();
    await new CreateContestUseCase(store, factory).execute({ id: "contest-1", name: "TRT" });
    await new CreateSubjectUseCase(store, factory).execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Português",
      plannedStudyMinutes: 60
    });
    await new CreateTopicUseCase(store, factory).execute({
      id: "topic-1",
      subjectId: "subject-1",
      name: "Concordância"
    });
    await new CreateResourceUseCase(store, factory).execute({
      id: "resource-1",
      subjectId: "subject-1",
      title: "PDF 01",
      topicIds: ["topic-1"]
    });

    await new UpdateTopicUseCase(store, factory).execute({
      topicId: "topic-1",
      name: "Concordância verbal"
    });
    await new DeleteTopicUseCase(store, factory).execute({ topicId: "topic-1" });

    const data = await store.load();
    expect(data.topics).toHaveLength(0);
    expect(data.subjects[0].topicIds).toEqual([]);
    expect(data.resources[0].topicIds).toEqual([]);
  });
});
