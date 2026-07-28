import { describe, expect, it } from "vitest";
import { CycleState } from "@/domain/entities/CycleState";
import { Resource } from "@/domain/entities/Resource";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { StudySession } from "@/domain/entities/StudySession";
import { Subject } from "@/domain/entities/Subject";
import { CycleService } from "@/domain/services/CycleService";
import { GoalUnit } from "@/domain/types/GoalUnit";

const service = new CycleService();

const buildSubject = (overrides: {
  id?: string;
  order?: number;
  isActive?: boolean;
  resourceIds?: string[];
}): Subject =>
  new Subject(
    overrides.id ?? `subject-${Math.random().toString(36).slice(2, 9)}`,
    "contest-1",
    "Matéria",
    overrides.order ?? 1,
    overrides.isActive ?? true,
    60,
    undefined,
    overrides.resourceIds ?? [],
    []
  );

const buildResource = (
  id: string,
  subjectId: string,
  order: number,
  completed = false,
  goal?: ResourceGoal
): Resource => new Resource(id, subjectId, "Recurso", order, "pdf", goal, completed);

const buildRecord = (overrides: {
  subjectId: string;
  resourceId?: string;
  completed?: boolean;
  quantity?: number;
  unit?: GoalUnit;
}): StudyRecord =>
  new StudyRecord(
    `record-${Math.random().toString(36).slice(2, 9)}`,
    overrides.subjectId,
    "leitura",
    overrides.resourceId,
    undefined,
    overrides.quantity,
    overrides.unit,
    undefined,
    overrides.completed ?? false
  );

const sessionOf = (contestId: string, ...records: StudyRecord[]): StudySession =>
  new StudySession(
    `session-${Math.random().toString(36).slice(2, 9)}`,
    contestId,
    "2026-07-27",
    records
  );

describe("CycleService subject rotation", () => {
  it("returns null when there are no subjects", () => {
    expect(service.getNextActiveSubject([])).toBeNull();
  });

  it("returns null when every subject is inactive", () => {
    const subjects = [buildSubject({ isActive: false }), buildSubject({ isActive: false })];

    expect(service.getNextActiveSubject(subjects)).toBeNull();
  });

  it("returns the first active subject when there is no current subject", () => {
    const first = buildSubject({ id: "s1", order: 1 });
    const second = buildSubject({ id: "s2", order: 2 });

    expect(service.getNextActiveSubject([second, first])?.id).toBe("s1");
  });

  it("rotates to the next active subject and wraps around", () => {
    const subjects = [
      buildSubject({ id: "s1", order: 1 }),
      buildSubject({ id: "s2", order: 2 }),
      buildSubject({ id: "s3", order: 3 })
    ];

    expect(service.getNextActiveSubject(subjects, "s1")?.id).toBe("s2");
    expect(service.getNextActiveSubject(subjects, "s3")?.id).toBe("s1");
  });

  it("skips inactive subjects and ignores an unknown or inactive current", () => {
    const subjects = [
      buildSubject({ id: "s1", order: 1 }),
      buildSubject({ id: "s2", order: 2, isActive: false }),
      buildSubject({ id: "s3", order: 3 })
    ];

    expect(service.getNextActiveSubject(subjects, "s1")?.id).toBe("s3");
    expect(service.getNextActiveSubject(subjects, "s2")?.id).toBe("s1");
    expect(service.getNextActiveSubject(subjects, "missing")?.id).toBe("s1");
  });
});

describe("CycleService recommendation", () => {
  it("recommends the first active subject and its first incomplete resource in order", () => {
    const subject = buildSubject({ id: "s1", order: 1, resourceIds: ["r1", "r2", "r3"] });
    const resources = [
      buildResource("r1", "s1", 1, true),
      buildResource("r2", "s1", 2),
      buildResource("r3", "s1", 3)
    ];

    const recommendation = service.getRecommendation([subject], resources, [], undefined);

    expect(recommendation).toEqual({ subjectId: "s1", resourceId: "r2" });
  });

  it("keeps the stored current subject when it is still active", () => {
    const first = buildSubject({ id: "s1", order: 1, resourceIds: ["r1"] });
    const second = buildSubject({ id: "s2", order: 2, resourceIds: ["r2"] });
    const resources = [buildResource("r1", "s1", 1), buildResource("r2", "s2", 1)];
    const state = new CycleState("contest-1", "s2", "r2");

    expect(service.getRecommendation([first, second], resources, [], state)).toEqual({
      subjectId: "s2",
      resourceId: "r2"
    });
  });

  it("falls back to the first active subject when the stored subject is gone or inactive", () => {
    const first = buildSubject({ id: "s1", order: 1 });
    const paused = buildSubject({ id: "s2", order: 2, isActive: false });
    const state = new CycleState("contest-1", "s2", null);

    expect(service.getRecommendation([first, paused], [], [], state).subjectId).toBe("s1");
    expect(
      service.getRecommendation([first], [], [], new CycleState("contest-1", "missing", null))
        .subjectId
    ).toBe("s1");
  });

  it("skips resources completed by goal progress when recommending", () => {
    const subject = buildSubject({ id: "s1", order: 1, resourceIds: ["r1", "r2"] });
    const resources = [
      buildResource("r1", "s1", 1, false, new ResourceGoal(10, GoalUnit.PAGINAS)),
      buildResource("r2", "s1", 2)
    ];
    const sessions = [
      sessionOf(
        "contest-1",
        buildRecord({ subjectId: "s1", resourceId: "r1", quantity: 10, unit: GoalUnit.PAGINAS })
      )
    ];

    expect(service.getRecommendation([subject], resources, sessions, undefined).resourceId).toBe(
      "r2"
    );
  });

  it("returns a null resource when the subject has no resources or all are complete", () => {
    const empty = buildSubject({ id: "s1", order: 1 });
    expect(service.getRecommendation([empty], [], [], undefined)).toEqual({
      subjectId: "s1",
      resourceId: null
    });

    const done = buildSubject({ id: "s2", order: 1, resourceIds: ["r1"] });
    const resources = [buildResource("r1", "s2", 1, true)];
    expect(service.getRecommendation([done], resources, [], undefined).resourceId).toBeNull();
  });

  it("returns a null recommendation when no subject is active", () => {
    const paused = buildSubject({ id: "s1", isActive: false });

    expect(service.getRecommendation([paused], [], [], undefined)).toEqual({
      subjectId: null,
      resourceId: null
    });
  });
});

describe("CycleService.advance", () => {
  it("rotates to the next active subject pointing at its first incomplete resource", () => {
    const first = buildSubject({ id: "s1", order: 1, resourceIds: ["r1"] });
    const second = buildSubject({ id: "s2", order: 2, resourceIds: ["r2", "r3"] });
    const resources = [
      buildResource("r1", "s1", 1),
      buildResource("r2", "s2", 1, true),
      buildResource("r3", "s2", 2)
    ];
    const state = new CycleState("contest-1", "s1", "r1");

    expect(service.advance([first, second], resources, [], state)).toEqual({
      subjectId: "s2",
      resourceId: "r3"
    });
  });

  it("starts at the first active subject when there is no stored position", () => {
    const subject = buildSubject({ id: "s1", order: 1, resourceIds: ["r1"] });
    const resources = [buildResource("r1", "s1", 1)];

    expect(service.advance([subject], resources, [], undefined)).toEqual({
      subjectId: "s1",
      resourceId: "r1"
    });
  });

  it("returns null when no subject is active", () => {
    const paused = buildSubject({ id: "s1", isActive: false });

    expect(service.advance([paused], [], [], new CycleState("contest-1", "s1", null))).toBeNull();
  });
});

describe("CycleService.advanceForCompletedRecords", () => {
  const setup = () => {
    const subjects = [
      buildSubject({ id: "s1", order: 1, resourceIds: ["r1"] }),
      buildSubject({ id: "s2", order: 2, resourceIds: ["r2"] }),
      buildSubject({ id: "s3", order: 3, resourceIds: [] })
    ];
    const resources = [buildResource("r1", "s1", 1), buildResource("r2", "s2", 1)];
    return { subjects, resources };
  };

  it("advances through consecutive records matching consecutive recommendations", () => {
    const { subjects, resources } = setup();
    const state = new CycleState("contest-1", "s1", "r1");
    const records = [
      buildRecord({ subjectId: "s1", resourceId: "r1", completed: true }),
      buildRecord({ subjectId: "s2", resourceId: "r2", completed: true })
    ];

    const result = service.advanceForCompletedRecords(subjects, resources, [], state, records);

    expect(result).toEqual({
      position: { subjectId: "s3", resourceId: null },
      advancements: 2
    });
  });

  it("stops at the first mismatch but keeps the advancements already made", () => {
    const { subjects, resources } = setup();
    const state = new CycleState("contest-1", "s1", "r1");
    const records = [
      buildRecord({ subjectId: "s1", resourceId: "r1", completed: true }),
      buildRecord({ subjectId: "s3", completed: true })
    ];

    const result = service.advanceForCompletedRecords(subjects, resources, [], state, records);

    expect(result).toEqual({ position: { subjectId: "s2", resourceId: "r2" }, advancements: 1 });
  });

  it("stops at the first record that is not completed", () => {
    const { subjects, resources } = setup();
    const state = new CycleState("contest-1", "s1", "r1");
    const records = [
      buildRecord({ subjectId: "s1", resourceId: "r1", completed: false }),
      buildRecord({ subjectId: "s1", resourceId: "r1", completed: true })
    ];

    const result = service.advanceForCompletedRecords(subjects, resources, [], state, records);

    expect(result).toEqual({ position: { subjectId: "s1", resourceId: "r1" }, advancements: 0 });
  });

  it("requires the record resource to match the recommendation exactly", () => {
    const { subjects, resources } = setup();
    const state = new CycleState("contest-1", "s1", "r1");
    const wrongResource = [buildRecord({ subjectId: "s1", resourceId: "rX", completed: true })];
    const missingResource = [buildRecord({ subjectId: "s1", completed: true })];

    expect(
      service.advanceForCompletedRecords(subjects, resources, [], state, wrongResource).advancements
    ).toBe(0);
    expect(
      service.advanceForCompletedRecords(subjects, resources, [], state, missingResource)
        .advancements
    ).toBe(0);
  });

  it("matches a subject-only record when the recommendation has no resource", () => {
    const { subjects, resources } = setup();
    const state = new CycleState("contest-1", "s3", null);
    const records = [buildRecord({ subjectId: "s3", completed: true })];

    const result = service.advanceForCompletedRecords(subjects, resources, [], state, records);

    expect(result).toEqual({ position: { subjectId: "s1", resourceId: "r1" }, advancements: 1 });
  });

  it("does not advance when the first record already mismatches", () => {
    const { subjects, resources } = setup();
    const state = new CycleState("contest-1", "s1", "r1");
    const records = [buildRecord({ subjectId: "s2", resourceId: "r2", completed: true })];

    const result = service.advanceForCompletedRecords(subjects, resources, [], state, records);

    expect(result).toEqual({ position: { subjectId: "s1", resourceId: "r1" }, advancements: 0 });
  });

  it("counts records saved in the same session when picking the next recommendation", () => {
    const subjects = [
      buildSubject({ id: "s1", order: 1, resourceIds: ["r1"] }),
      buildSubject({ id: "s2", order: 2, resourceIds: ["r2", "r3"] })
    ];
    const resources = [
      buildResource("r1", "s1", 1),
      buildResource("r2", "s2", 1, false, new ResourceGoal(10, GoalUnit.PAGINAS)),
      buildResource("r3", "s2", 2)
    ];
    const state = new CycleState("contest-1", "s1", "r1");
    const prior = [
      sessionOf(
        "contest-1",
        buildRecord({
          subjectId: "s2",
          resourceId: "r2",
          completed: true,
          quantity: 5,
          unit: GoalUnit.PAGINAS
        })
      )
    ];
    const records = [
      buildRecord({ subjectId: "s1", resourceId: "r1", completed: true }),
      buildRecord({
        subjectId: "s2",
        resourceId: "r2",
        completed: true,
        quantity: 5,
        unit: GoalUnit.PAGINAS
      })
    ];

    const result = service.advanceForCompletedRecords(subjects, resources, prior, state, records);

    expect(result).toEqual({ position: { subjectId: "s1", resourceId: "r1" }, advancements: 2 });

    // r2's goal is met by prior + same-session progress, so s2's next recommendation is r3.
    const all = [...prior, sessionOf("contest-1", ...records)];
    expect(
      service.getRecommendation(subjects, resources, all, new CycleState("contest-1", "s2", null))
        .resourceId
    ).toBe("r3");
  });
});
