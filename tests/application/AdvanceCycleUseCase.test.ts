import { describe, expect, it } from "vitest";

import { AdvanceCycleUseCase } from "@/application/use-cases/AdvanceCycleUseCase";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateResourceUseCase } from "@/application/use-cases/CreateResourceUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { GoalUnit } from "@/domain/types/GoalUnit";
import { createTestStore } from "../helpers/InMemoryStore";

async function seedCycle() {
  const { store, factory } = createTestStore();
  await new CreateContestUseCase(store, factory).execute({ id: "contest-1", name: "TRT" });
  await new CreateSubjectUseCase(store, factory).execute({
    id: "subject-1",
    contestId: "contest-1",
    name: "Português",
    plannedStudyMinutes: 60
  });
  await new CreateSubjectUseCase(store, factory).execute({
    id: "subject-2",
    contestId: "contest-1",
    name: "Direito",
    plannedStudyMinutes: 45
  });
  await new CreateResourceUseCase(store, factory).execute({
    id: "resource-1",
    subjectId: "subject-1",
    title: "PDF 01",
    goal: new ResourceGoal(10, GoalUnit.PAGINAS)
  });
  await new CreateResourceUseCase(store, factory).execute({
    id: "resource-2",
    subjectId: "subject-2",
    title: "PDF 02"
  });
  return { store, factory };
}

describe("AdvanceCycleUseCase", () => {
  it("rotates to the next active subject and its first incomplete resource", async () => {
    const { store } = await seedCycle();

    const result = await new AdvanceCycleUseCase(store).execute();

    expect(result.previous).toEqual({ subjectId: "subject-1", resourceId: "resource-1" });
    expect(result.current).toEqual({ subjectId: "subject-2", resourceId: "resource-2" });
    expect((await store.load()).cycleStates[0]).toMatchObject({
      currentSubjectId: "subject-2",
      currentResourceId: "resource-2"
    });
  });

  it("skips completed resources when calculating the next recommendation", async () => {
    const { store, factory } = await seedCycle();
    await new RegisterStudySessionUseCase(store, factory).execute({
      contestId: "contest-1",
      date: "2026-07-27",
      records: [
        {
          subjectId: "subject-1",
          resourceId: "resource-1",
          quantity: 10,
          unit: GoalUnit.PAGINAS,
          completed: true
        }
      ]
    });

    await new AdvanceCycleUseCase(store).execute();

    expect((await store.load()).cycleStates[0].currentResourceId).toBeNull();
  });
});
