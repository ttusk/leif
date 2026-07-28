import { describe, expect, it } from "vitest";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { StudySession } from "@/domain/entities/StudySession";
import { GoalUnit } from "@/domain/types/GoalUnit";
import { ValidationError } from "@/domain/errors/DomainErrors";

describe("StudyRecord", () => {
  it("requires an id, exactly one subject and an activity", () => {
    expect(() => new StudyRecord("", "subject-1", "leitura")).toThrow(ValidationError);
    expect(() => new StudyRecord("record-1", "", "leitura")).toThrow(ValidationError);
    expect(() => new StudyRecord("record-1", "subject-1", " ")).toThrow(ValidationError);
  });

  it("points to at most one resource and one topic", () => {
    const record = new StudyRecord("record-1", "subject-1", "leitura", "resource-1", "topic-1");

    expect(record.resourceId).toBe("resource-1");
    expect(record.topicId).toBe("topic-1");
  });

  it("validates quantity, unit and correct answers as a coherent group", () => {
    expect(() => new StudyRecord("r", "s", "leitura", undefined, undefined, 30)).toThrow(
      ValidationError
    );
    expect(
      () => new StudyRecord("r", "s", "leitura", undefined, undefined, undefined, GoalUnit.PAGINAS)
    ).toThrow(ValidationError);
    expect(
      () => new StudyRecord("r", "s", "questoes", undefined, undefined, -1, GoalUnit.QUESTOES)
    ).toThrow(ValidationError);
    expect(
      () => new StudyRecord("r", "s", "questoes", undefined, undefined, 20, GoalUnit.QUESTOES, 21)
    ).toThrow(ValidationError);
    expect(
      () => new StudyRecord("r", "s", "questoes", undefined, undefined, undefined, undefined, 5)
    ).toThrow(ValidationError);

    const record = new StudyRecord(
      "r",
      "s",
      "questoes",
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
      "s",
      "leitura",
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
    expect(new StudyRecord("r", "s", "leitura").completed).toBe(false);
  });
});

describe("StudySession", () => {
  const record = () => new StudyRecord("record-1", "subject-1", "leitura");

  it("owns one or more ordered records", () => {
    const session = new StudySession("session-1", "contest-1", "2026-07-27", [
      record(),
      new StudyRecord("record-2", "subject-2", "questoes")
    ]);

    expect(session.records.map((entry) => entry.id)).toEqual(["record-1", "record-2"]);
  });

  it("rejects an empty record list so empty sessions never persist", () => {
    expect(() => new StudySession("session-1", "contest-1", "2026-07-27", [])).toThrow(
      ValidationError
    );
  });

  it("requires an id, a contest and an ISO date", () => {
    expect(() => new StudySession("", "contest-1", "2026-07-27", [record()])).toThrow(
      ValidationError
    );
    expect(() => new StudySession("session-1", "", "2026-07-27", [record()])).toThrow(
      ValidationError
    );
    expect(() => new StudySession("session-1", "contest-1", "27/07/2026", [record()])).toThrow(
      ValidationError
    );
  });

  it("accepts optional start and end times and free-form notes", () => {
    const session = new StudySession("s", "c", "2026-07-27", [record()], "19:00", "21:00", "leve");

    expect(session.startTime).toBe("19:00");
    expect(session.endTime).toBe("21:00");
    expect(session.notes).toBe("leve");
  });

  it("rejects malformed times", () => {
    expect(() => new StudySession("s", "c", "2026-07-27", [record()], "19h")).toThrow(
      ValidationError
    );
    expect(() => new StudySession("s", "c", "2026-07-27", [record()], "25:00")).toThrow(
      ValidationError
    );
    expect(() => new StudySession("s", "c", "2026-07-27", [record()], "19:00", "18:75")).toThrow(
      ValidationError
    );
  });
});
