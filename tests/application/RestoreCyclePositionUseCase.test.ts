import { describe, expect, it } from "vitest";

import { RestoreCyclePositionUseCase } from "@/application/use-cases/RestoreCyclePositionUseCase";
import { CycleState } from "@/domain/entities/CycleState";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import { createTestStore } from "../helpers/InMemoryStore";

describe("RestoreCyclePositionUseCase", () => {
  it("restores the cycle position when the current state matches", async () => {
    const { store } = createTestStore({
      ...createDefaultLeifPluginData(),
      cycleStates: [new CycleState("contest-1", "subject-2", "resource-2")]
    });

    await new RestoreCyclePositionUseCase(store).execute({
      contestId: "contest-1",
      expectedCurrent: { subjectId: "subject-2", resourceId: "resource-2" },
      restoreTo: { subjectId: "subject-1", resourceId: "resource-1" }
    });

    expect((await store.load()).cycleStates[0]).toMatchObject({
      currentSubjectId: "subject-1",
      currentResourceId: "resource-1"
    });
  });

  it("rejects restore when the cycle has changed", async () => {
    const { store } = createTestStore({
      ...createDefaultLeifPluginData(),
      cycleStates: [new CycleState("contest-1", "subject-2", "resource-2")]
    });

    await expect(
      new RestoreCyclePositionUseCase(store).execute({
        contestId: "contest-1",
        expectedCurrent: { subjectId: "subject-1", resourceId: "resource-1" },
        restoreTo: { subjectId: "subject-1", resourceId: "resource-1" }
      })
    ).rejects.toThrow(ValidationError);
  });
});
