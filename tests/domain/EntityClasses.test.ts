import { describe, expect, it } from "vitest";
import { Contest } from "@/domain/entities/Contest";
import { CycleState } from "@/domain/entities/CycleState";
import { Mural, MuralSubjectSnapshot } from "@/domain/entities/Mural";
import { Subject } from "@/domain/entities/Subject";
import { Topic } from "@/domain/entities/Topic";
import { ValidationError } from "@/domain/errors/DomainErrors";

describe("Contest", () => {
  it("requires an id and a name", () => {
    expect(() => new Contest("", "TRT")).toThrow(ValidationError);
    expect(() => new Contest("contest-1", " ")).toThrow(ValidationError);
  });

  it("keeps subject order, exam plan and an empty mural by default", () => {
    const contest = new Contest("contest-1", "TRT", ["s2", "s1"], undefined, {
      examDate: "2026-09-14",
      board: "FCC",
      weeklyStudyHours: 20,
      weeklyQuestionGoal: 500
    });

    expect(contest.subjectIds).toEqual(["s2", "s1"]);
    expect(contest.mural.snapshots).toEqual([]);
    expect(contest.examPlan?.board).toBe("FCC");
  });

  it("carries a mural with notes and subject snapshots", () => {
    const mural = new Mural("Edital em maio.", [
      new MuralSubjectSnapshot("subject-1", 3, 40, ["Recurso alvo"])
    ]);
    const contest = new Contest("contest-1", "TRT", [], mural);

    expect(contest.mural.notes).toBe("Edital em maio.");
    expect(contest.mural.snapshots[0].targetResources).toEqual(["Recurso alvo"]);
  });
});

describe("MuralSubjectSnapshot", () => {
  it("requires a subject and non-negative numbers", () => {
    expect(() => new MuralSubjectSnapshot("")).toThrow(ValidationError);
    expect(() => new MuralSubjectSnapshot("subject-1", -1)).toThrow(ValidationError);
    expect(() => new MuralSubjectSnapshot("subject-1", undefined, -2)).toThrow(ValidationError);
  });
});

describe("Subject", () => {
  it("requires ids, name and a positive order", () => {
    expect(() => new Subject("", "contest-1", "Português", 1)).toThrow(ValidationError);
    expect(() => new Subject("subject-1", "", "Português", 1)).toThrow(ValidationError);
    expect(() => new Subject("subject-1", "contest-1", " ", 1)).toThrow(ValidationError);
    expect(() => new Subject("subject-1", "contest-1", "Português", 0)).toThrow(ValidationError);
  });

  it("keeps ordered resource and topic collections with sane defaults", () => {
    const subject = new Subject("subject-1", "contest-1", "Português", 2, false, 45, "Questões", [
      "r1",
      "r2"
    ]);

    expect(subject.isActive).toBe(false);
    expect(subject.plannedStudyMinutes).toBe(45);
    expect(subject.currentStage).toBe("Questões");
    expect(subject.resourceIds).toEqual(["r1", "r2"]);
    expect(subject.topicIds).toEqual([]);
  });

  it("rejects negative planned minutes", () => {
    expect(() => new Subject("subject-1", "contest-1", "Português", 1, true, -5)).toThrow(
      ValidationError
    );
  });
});

describe("Topic", () => {
  it("requires an id, a subject and a name", () => {
    expect(() => new Topic("", "subject-1", "Concordância")).toThrow(ValidationError);
    expect(() => new Topic("topic-1", "", "Concordância")).toThrow(ValidationError);
    expect(() => new Topic("topic-1", "subject-1", " ")).toThrow(ValidationError);
  });
});

describe("CycleState", () => {
  it("requires a contest and starts without a position", () => {
    expect(() => new CycleState("")).toThrow(ValidationError);

    const state = new CycleState("contest-1");
    expect(state.currentSubjectId).toBeNull();
    expect(state.currentResourceId).toBeNull();
  });

  it("stores the current subject and resource pointers", () => {
    const state = new CycleState("contest-1", "subject-1", "resource-1");

    expect(state.currentSubjectId).toBe("subject-1");
    expect(state.currentResourceId).toBe("resource-1");
  });
});
