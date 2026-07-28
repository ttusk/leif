import { isGoalUnit, type GoalUnit } from "@/domain/types/GoalUnit";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const ValidationResult = {
  ok(): ValidationResult {
    return { valid: true, errors: [] };
  },
  fail(errors: string[]): ValidationResult {
    return { valid: false, errors };
  }
};

function requireNonEmpty(value: string | undefined, field: string): string | undefined {
  if (!value || !value.trim()) {
    return `${field} is required`;
  }
  return undefined;
}

function requireNonNegative(value: number | undefined, field: string): string | undefined {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    return `${field} cannot be negative`;
  }
  return undefined;
}

function requirePositive(value: number | undefined, field: string): string | undefined {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    return `${field} must be positive`;
  }
  return undefined;
}

function requireMinLength(
  value: string | undefined,
  field: string,
  minLength: number
): string | undefined {
  if (value && value.trim().length < minLength) {
    return `${field} must have at least ${minLength} characters`;
  }
  return undefined;
}

function requireValidUnit(value: GoalUnit | undefined, field: string): string | undefined {
  if (value !== undefined && !isGoalUnit(value)) {
    return `${field} must be one of: paginas, questoes, aulas, minutos`;
  }
  return undefined;
}

function collectErrors(...checks: Array<string | undefined>): ValidationResult {
  const errors = checks.filter((error): error is string => error !== undefined);
  return errors.length > 0 ? ValidationResult.fail(errors) : ValidationResult.ok();
}

export class CreateContestValidator {
  validate(input: { id: string; name: string }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.id, "Contest ID"),
      requireNonEmpty(input.name, "Contest name"),
      requireMinLength(input.name, "Contest name", 1)
    );
  }
}

export class CreateSubjectValidator {
  validate(input: {
    id: string;
    contestId: string;
    name: string;
    plannedStudyMinutes: number;
  }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.id, "Subject ID"),
      requireNonEmpty(input.contestId, "Contest ID"),
      requireNonEmpty(input.name, "Subject name"),
      requireNonNegative(input.plannedStudyMinutes, "Planned study minutes")
    );
  }
}

export class CreateResourceValidator {
  validate(input: {
    subjectId: string;
    title: string;
    goalAmount?: number;
    goalUnit?: GoalUnit;
  }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.subjectId, "Subject ID"),
      requireNonEmpty(input.title, "Resource title"),
      requirePositive(input.goalAmount, "Resource goal"),
      requireValidUnit(input.goalUnit, "Resource goal unit"),
      input.goalAmount !== undefined && input.goalUnit === undefined
        ? "Resource goal requires a unit"
        : undefined,
      input.goalUnit !== undefined && input.goalAmount === undefined
        ? "Resource goal unit requires an amount"
        : undefined
    );
  }
}

export class CreateTopicValidator {
  validate(input: { id: string; subjectId: string; name: string }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.id, "Topic ID"),
      requireNonEmpty(input.subjectId, "Subject ID"),
      requireNonEmpty(input.name, "Topic name")
    );
  }
}

export class RegisterStudySessionValidator {
  validate(input: {
    contestId: string;
    date: string;
    records: Array<{ subjectId: string; activity: string; unit?: GoalUnit }>;
  }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.contestId, "Contest ID"),
      requireNonEmpty(input.date, "Session date"),
      !Array.isArray(input.records) || input.records.length === 0
        ? "Session requires at least one record"
        : undefined,
      ...(input.records ?? [])
        .map((record, index) =>
          collectErrors(
            requireNonEmpty(record.subjectId, `Record ${index + 1} subject`),
            requireNonEmpty(record.activity, `Record ${index + 1} activity`),
            requireValidUnit(record.unit, `Record ${index + 1} unit`)
          ).errors.join(", ")
        )
        .filter((message) => message.length > 0)
    );
  }
}

export class ReorderSubjectsValidator {
  validate(input: { contestId: string; subjectIdsInOrder: string[] }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.contestId, "Contest ID"),
      input.subjectIdsInOrder.length === 0 ? "Subject order list cannot be empty" : undefined
    );
  }
}

export class SetActiveContestValidator {
  validate(input: { contestId: string }): ValidationResult {
    return collectErrors(requireNonEmpty(input.contestId, "Contest ID"));
  }
}

export class SetSubjectActiveStateValidator {
  validate(input: { subjectId: string }): ValidationResult {
    return collectErrors(requireNonEmpty(input.subjectId, "Subject ID"));
  }
}

export class UpdateSubjectConfigurationValidator {
  validate(input: { subjectId: string; plannedStudyMinutes?: number }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.subjectId, "Subject ID"),
      requireNonNegative(input.plannedStudyMinutes, "Planned study minutes")
    );
  }
}

export class DeleteStudySessionValidator {
  validate(input: { sessionId: string }): ValidationResult {
    return collectErrors(requireNonEmpty(input.sessionId, "Session ID"));
  }
}

export class AddResourceAccessValidator {
  validate(input: { resourceId: string; title: string; url: string }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.resourceId, "Resource ID"),
      requireNonEmpty(input.title, "Access title"),
      requireNonEmpty(input.url, "Access url")
    );
  }
}

export class UpdateContestMuralValidator {
  validate(input: {
    contestId: string;
    snapshots?: Array<{ subjectId: string; weight?: number; score?: number }>;
  }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.contestId, "Contest ID"),
      ...(input.snapshots ?? [])
        .map((snapshot, index) =>
          collectErrors(
            requireNonEmpty(snapshot.subjectId, `Snapshot ${index + 1} subject`),
            requireNonNegative(snapshot.weight, `Snapshot ${index + 1} weight`),
            requireNonNegative(snapshot.score, `Snapshot ${index + 1} score`)
          ).errors.join(", ")
        )
        .filter((message) => message.length > 0)
    );
  }
}
