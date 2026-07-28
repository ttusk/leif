import { describe, expect, it } from "vitest";

import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateResourceUseCase } from "@/application/use-cases/CreateResourceUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { GetActiveContestProgressDashboardUseCase } from "@/application/use-cases/GetActiveContestProgressDashboardUseCase";
import { RegisterStudyRecordsUseCase } from "@/application/use-cases/RegisterStudyRecordsUseCase";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { GoalUnit } from "@/domain/types/GoalUnit";
import { createTestStore } from "../helpers/InMemoryStore";

describe("resource goal progress", () => {
  it("reports per-resource goal progress and completion", async () => {
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
      title: "PDF 01",
      goal: new ResourceGoal(30, GoalUnit.PAGINAS)
    });
    await new RegisterStudyRecordsUseCase(store).execute({
      contestId: "contest-1",
      date: "2026-07-27",
      records: [
        {
          subjectId: "subject-1",
          resourceId: "resource-1",
          quantity: 30,
          unit: GoalUnit.PAGINAS,
          completed: true
        }
      ]
    });

    await expect(
      new GetActiveContestProgressDashboardUseCase(store).execute()
    ).resolves.toMatchObject({
      resourceProgressBySubject: [
        {
          subjectId: "subject-1",
          resources: [
            {
              resourceId: "resource-1",
              progress: 30,
              goal: 30,
              completed: true
            }
          ]
        }
      ]
    });
  });

  it("groups question progress by record date", async () => {
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
      records: [
        {
          subjectId: "subject-1",
          quantity: 20,
          unit: GoalUnit.QUESTOES,
          correctAnswers: 15
        }
      ]
    });

    await expect(
      new GetActiveContestProgressDashboardUseCase(store).execute()
    ).resolves.toMatchObject({
      questionProgressBySubject: [
        {
          subjectId: "subject-1",
          points: [{ date: "2026-07-27", questionCount: 20, correctAnswers: 15, accuracy: 0.75 }]
        }
      ]
    });
  });
});
