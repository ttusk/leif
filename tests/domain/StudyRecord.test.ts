import { describe, expect, it } from "vitest";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { GoalUnit } from "@/domain/types/GoalUnit";
import { ValidationError } from "@/domain/errors/DomainErrors";

describe("StudyRecord", () => {
  it("is an independent dated fact belonging to one contest and subject", () => {
    const record = new StudyRecord("record-1", "contest-1", "2026-07-27", "subject-1");

    expect(record.contestId).toBe("contest-1");
    expect(record.date).toBe("2026-07-27");
    expect(record.subjectId).toBe("subject-1");
  });

  it("requires an id, contest, ISO date and subject", () => {
    expect(() => new StudyRecord("", "contest-1", "2026-07-27", "subject-1")).toThrow(
      ValidationError
    );
    expect(() => new StudyRecord("record-1", "", "2026-07-27", "subject-1")).toThrow(
      ValidationError
    );
    expect(() => new StudyRecord("record-1", "contest-1", "27/07/2026", "subject-1")).toThrow(
      ValidationError
    );
    expect(() => new StudyRecord("record-1", "contest-1", "2026-07-27", "")).toThrow(
      ValidationError
    );
  });

  it("points to at most one resource and one topic", () => {
    const record = new StudyRecord(
      "record-1",
      "contest-1",
      "2026-07-27",
      "subject-1",
      "resource-1",
      "topic-1"
    );

    expect(record.resourceId).toBe("resource-1");
    expect(record.topicId).toBe("topic-1");
  });

  it("validates quantity, unit and correct answers as a coherent group", () => {
    expect(() => new StudyRecord("r", "c", "2026-07-27", "s", undefined, undefined, 30)).toThrow(
      ValidationError
    );
    expect(
      () =>
        new StudyRecord(
          "r",
          "c",
          "2026-07-27",
          "s",
          undefined,
          undefined,
          undefined,
          GoalUnit.PAGINAS
        )
    ).toThrow(ValidationError);
    expect(
      () =>
        new StudyRecord("r", "c", "2026-07-27", "s", undefined, undefined, -1, GoalUnit.QUESTOES)
    ).toThrow(ValidationError);
    expect(
      () =>
        new StudyRecord(
          "r",
          "c",
          "2026-07-27",
          "s",
          undefined,
          undefined,
          20,
          GoalUnit.QUESTOES,
          21
        )
    ).toThrow(ValidationError);
    expect(
      () =>
        new StudyRecord("r", "c", "2026-07-27", "s", undefined, undefined, undefined, undefined, 5)
    ).toThrow(ValidationError);

    const record = new StudyRecord(
      "r",
      "c",
      "2026-07-27",
      "s",
      undefined,
      undefined,
      20,
      GoalUnit.QUESTOES,
      15
    );
    expect(record.quantity).toBe(20);
    expect(record.unit).toBe(GoalUnit.QUESTOES);
    expect(record.correctAnswers).toBe(15);
  });

  it("distinguishes a completed record from a completed resource and keeps notes", () => {
    const record = new StudyRecord(
      "r",
      "c",
      "2026-07-27",
      "s",
      "resource-1",
      undefined,
      30,
      GoalUnit.PAGINAS,
      undefined,
      true,
      "cap. 3"
    );

    expect(record.completed).toBe(true);
    expect(record.notes).toBe("cap. 3");
  });

  it("defaults to not completed", () => {
    expect(new StudyRecord("r", "c", "2026-07-27", "s").completed).toBe(false);
  });
});
