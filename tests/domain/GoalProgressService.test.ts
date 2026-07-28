import { describe, expect, it } from "vitest";
import { ImportedProgress } from "@/domain/entities/ImportedProgress";
import { Resource } from "@/domain/entities/Resource";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { StudySession } from "@/domain/entities/StudySession";
import { GoalProgressService } from "@/domain/services/GoalProgressService";
import { GoalUnit } from "@/domain/types/GoalUnit";

const service = new GoalProgressService();

const buildResource = (overrides: {
  id?: string;
  goal?: ResourceGoal;
  completed?: boolean;
  baseline?: ImportedProgress;
}): Resource =>
  new Resource(
    overrides.id ?? "resource-1",
    "subject-1",
    "Recurso",
    1,
    "pdf",
    overrides.goal,
    overrides.completed ?? false,
    [],
    [],
    overrides.baseline
  );

const buildRecord = (overrides: {
  id?: string;
  resourceId?: string;
  quantity?: number;
  unit?: GoalUnit;
  correctAnswers?: number;
}): StudyRecord =>
  new StudyRecord(
    overrides.id ?? `record-${Math.random().toString(36).slice(2, 9)}`,
    "subject-1",
    "leitura",
    overrides.resourceId,
    undefined,
    overrides.quantity,
    overrides.unit,
    overrides.correctAnswers
  );

const sessionOf = (...records: StudyRecord[]): StudySession =>
  new StudySession(
    `session-${Math.random().toString(36).slice(2, 9)}`,
    "contest-1",
    "2026-07-27",
    records
  );

describe("GoalProgressService", () => {
  it("aggregates only records whose unit matches the resource goal", () => {
    const resource = buildResource({ goal: new ResourceGoal(100, GoalUnit.PAGINAS) });
    const sessions = [
      sessionOf(
        buildRecord({ resourceId: "resource-1", quantity: 30, unit: GoalUnit.PAGINAS }),
        buildRecord({ resourceId: "resource-1", quantity: 50, unit: GoalUnit.QUESTOES })
      ),
      sessionOf(buildRecord({ resourceId: "resource-1", quantity: 25, unit: GoalUnit.PAGINAS })),
      sessionOf(buildRecord({ resourceId: "resource-2", quantity: 90, unit: GoalUnit.PAGINAS }))
    ];

    expect(service.progressFor(resource, sessions)).toBe(55);
  });

  it("completes a goal-bearing resource when accumulated records reach the goal", () => {
    const resource = buildResource({ goal: new ResourceGoal(100, GoalUnit.PAGINAS) });
    const below = [
      sessionOf(buildRecord({ resourceId: "resource-1", quantity: 99, unit: GoalUnit.PAGINAS }))
    ];
    const reached = [
      ...below,
      sessionOf(buildRecord({ resourceId: "resource-1", quantity: 1, unit: GoalUnit.PAGINAS }))
    ];

    expect(service.isComplete(resource, below)).toBe(false);
    expect(service.isComplete(resource, reached)).toBe(true);
  });

  it("keeps a goal-less resource incomplete until explicitly completed", () => {
    const resource = buildResource({});
    const sessions = [
      sessionOf(buildRecord({ resourceId: "resource-1", quantity: 500, unit: GoalUnit.PAGINAS }))
    ];

    expect(service.isComplete(resource, sessions)).toBe(false);
    expect(service.isComplete(buildResource({ completed: true }), sessions)).toBe(true);
  });

  it("treats explicit completion as an override even when a goal is unmet", () => {
    const resource = buildResource({
      goal: new ResourceGoal(100, GoalUnit.PAGINAS),
      completed: true
    });

    expect(service.isComplete(resource, [])).toBe(true);
  });

  it("adds an imported progress baseline without double-counting records", () => {
    const resource = buildResource({
      goal: new ResourceGoal(200, GoalUnit.QUESTOES),
      baseline: new ImportedProgress(120, 96)
    });
    const sessions = [
      sessionOf(
        buildRecord({
          resourceId: "resource-1",
          quantity: 30,
          unit: GoalUnit.QUESTOES,
          correctAnswers: 24
        })
      )
    ];

    expect(service.progressFor(resource, sessions)).toBe(150);
    expect(service.correctAnswersFor(resource, sessions)).toBe(120);
    expect(service.isComplete(resource, sessions)).toBe(false);
    expect(
      service.isComplete(resource, [
        ...sessions,
        sessionOf(buildRecord({ resourceId: "resource-1", quantity: 50, unit: GoalUnit.QUESTOES }))
      ])
    ).toBe(true);
  });

  it("builds a completion predicate keyed by resource id", () => {
    const resources = [
      buildResource({ id: "resource-1", completed: true }),
      buildResource({ id: "resource-2" })
    ];
    const isComplete = service.buildCompletionPredicate(resources, []);

    expect(isComplete("resource-1")).toBe(true);
    expect(isComplete("resource-2")).toBe(false);
    expect(isComplete("missing")).toBe(false);
  });
});
