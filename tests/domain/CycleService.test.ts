import { describe, expect, it } from "vitest";
import { CycleState } from "@/domain/entities/CycleState";
import { Resource } from "@/domain/entities/Resource";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { StudyRecord } from "@/domain/entities/StudyRecord";
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
    "contest-1",
    "2026-07-27",
    overrides.subjectId,
    overrides.resourceId,
    undefined,
    overrides.quantity,
    overrides.unit,
    undefined,
    overrides.completed ?? false
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
    const records = [
      buildRecord({ subjectId: "s1", resourceId: "r1", quantity: 10, unit: GoalUnit.PAGINAS })
    ];

    expect(service.getRecommendation([subject], resources, records, undefined).resourceId).toBe(
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
