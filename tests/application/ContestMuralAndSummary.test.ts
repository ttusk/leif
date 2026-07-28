import { describe, expect, it } from "vitest";

import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { GetActiveContestSummaryUseCase } from "@/application/use-cases/GetActiveContestSummaryUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { UpdateContestMuralUseCase } from "@/application/use-cases/UpdateContestMuralUseCase";
import { GoalUnit } from "@/domain/types/GoalUnit";
import { createTestStore } from "../helpers/InMemoryStore";

describe("contest mural and summary", () => {
  it("updates mural notes and subject snapshots", async () => {
    const { store, factory } = createTestStore();
    await new CreateContestUseCase(store, factory).execute({ id: "contest-1", name: "TRT" });
    await new CreateSubjectUseCase(store, factory).execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Português",
      plannedStudyMinutes: 60
    });

    await new UpdateContestMuralUseCase(store, factory).execute({
      contestId: "contest-1",
      notes: "Edital publicado",
      snapshots: [{ subjectId: "subject-1", weight: 2, score: 80, targetResources: ["resource-1"] }]
    });

    expect((await store.load()).contests[0].mural).toMatchObject({
      notes: "Edital publicado",
      snapshots: [{ subjectId: "subject-1", weight: 2, score: 80 }]
    });
  });

  it("summarizes records per subject", async () => {
    const { store, factory } = createTestStore();
    await new CreateContestUseCase(store, factory).execute({ id: "contest-1", name: "TRT" });
    await new CreateSubjectUseCase(store, factory).execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Português",
      plannedStudyMinutes: 60
    });
    await new RegisterStudySessionUseCase(store, factory).execute({
      contestId: "contest-1",
      date: "2026-07-27",
      records: [
        { subjectId: "subject-1", quantity: 20, unit: GoalUnit.PAGINAS },
        {
          subjectId: "subject-1",
          quantity: 10,
          unit: GoalUnit.QUESTOES,
          correctAnswers: 8
        },
        { subjectId: "subject-1", quantity: 30, unit: GoalUnit.MINUTOS }
      ]
    });

    await expect(new GetActiveContestSummaryUseCase(store).execute()).resolves.toMatchObject({
      subjectSummaries: [
        {
          subjectId: "subject-1",
          totalSessions: 1,
          pagesRead: 20,
          questionsSolved: 10,
          minutesStudied: 30,
          questionAccuracy: 0.8
        }
      ]
    });
  });
});
