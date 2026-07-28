import { describe, expect, it } from "vitest";
import { SelectCycleSubjectUseCase } from "@/application/use-cases/SelectCycleSubjectUseCase";
import { CycleState } from "@/domain/entities/CycleState";
import { Resource } from "@/domain/entities/Resource";
import { Subject } from "@/domain/entities/Subject";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { createTestStore } from "../helpers/InMemoryStore";

describe("SelectCycleSubjectUseCase", () => {
  it("moves only the visual recommendation to a learner-selected subject", async () => {
    const { store } = createTestStore();
    await store.mutate((data) => {
      data.activeContestId = "contest-1";
      data.contests.push({ id: "contest-1", name: "TRT", subjectIds: ["a", "b"] } as never);
      data.subjects.push(
        new Subject("a", "contest-1", "Português", 1, true, 60, undefined, ["ra"]),
        new Subject("b", "contest-1", "Direito", 2, true, 60, undefined, ["rb"])
      );
      data.resources.push(
        new Resource("ra", "a", "PDF A", 1),
        new Resource("rb", "b", "PDF B", 1)
      );
      data.cycleStates.push(new CycleState("contest-1", "a", "ra"));
    });

    const selected = await new SelectCycleSubjectUseCase(store).execute({ subjectId: "b" });

    expect(selected).toMatchObject({
      contestId: "contest-1",
      currentSubjectId: "b",
      currentResourceId: "rb"
    });
    expect((await store.load()).studyRecords).toEqual([]);
  });

  it("rejects a subject outside the active cycle", async () => {
    const { store } = createTestStore();
    await store.mutate((data) => {
      data.activeContestId = "contest-1";
      data.contests.push({ id: "contest-1", name: "TRT", subjectIds: ["a"] } as never);
      data.subjects.push(new Subject("a", "contest-1", "Português", 1, false));
    });

    await expect(
      new SelectCycleSubjectUseCase(store).execute({ subjectId: "a" })
    ).rejects.toThrow(ValidationError);
  });
});
