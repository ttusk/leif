import { describe, expect, it } from "vitest";

import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { DeleteContestUseCase } from "@/application/use-cases/DeleteContestUseCase";
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import { UpdateContestUseCase } from "@/application/use-cases/UpdateContestUseCase";
import { Resource } from "@/domain/entities/Resource";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { NotFoundError } from "@/domain/errors/DomainErrors";
import { createTestStore } from "../helpers/InMemoryStore";

describe("contest management", () => {
  it("creates the first contest with a cycle state and makes it active", async () => {
    const { store, factory } = createTestStore();

    await new CreateContestUseCase(store, factory).execute({ id: "contest-1", name: "TRT" });

    const data = await store.load();
    expect(data.activeContestId).toBe("contest-1");
    expect(data.cycleStates).toMatchObject([{ contestId: "contest-1" }]);
  });

  it("updates contest metadata and switches active contest", async () => {
    const { store, factory } = createTestStore();
    const createContest = new CreateContestUseCase(store, factory);
    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createContest.execute({ id: "contest-2", name: "SEFAZ" });

    const updated = await new UpdateContestUseCase(store, factory).execute({
      contestId: "contest-2",
      name: "SEFAZ Estadual",
      examPlan: { board: "FCC", weeklyStudyHours: 20 }
    });
    await new SetActiveContestUseCase(store, factory).execute({ contestId: "contest-2" });

    expect(updated).toMatchObject({
      name: "SEFAZ Estadual",
      examPlan: { board: "FCC", weeklyStudyHours: 20 }
    });
    expect((await store.load()).activeContestId).toBe("contest-2");
  });

  it("deletes a contest and cascades its study content", async () => {
    const { store, factory } = createTestStore();
    await new CreateContestUseCase(store, factory).execute({ id: "contest-1", name: "TRT" });
    await store.mutate((data) => {
      data.subjects.push({
        id: "subject-1",
        contestId: "contest-1",
        name: "Português",
        order: 1,
        isActive: true,
        plannedStudyMinutes: 60,
        resourceIds: ["resource-1"],
        topicIds: ["topic-1"]
      });
      data.resources.push(new Resource("resource-1", "subject-1", "Aula 01", 1));
      data.topics.push({ id: "topic-1", subjectId: "subject-1", name: "Concordância" });
      data.studyRecords.push(new StudyRecord("record-1", "contest-1", "2026-07-27", "subject-1"));
    });

    await new DeleteContestUseCase(store).execute({ contestId: "contest-1" });

    const data = await store.load();
    expect(data.activeContestId).toBeNull();
    expect(data.contests).toHaveLength(0);
    expect(data.subjects).toHaveLength(0);
    expect(data.resources).toHaveLength(0);
    expect(data.topics).toHaveLength(0);
    expect(data.studyRecords).toHaveLength(0);
    await expect(new DeleteContestUseCase(store).execute({ contestId: "missing" })).rejects.toThrow(
      NotFoundError
    );
  });
});
