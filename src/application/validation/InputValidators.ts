import type { Wall } from "@/domain/entities/Wall";

/**
 * Result of input validation.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Factory methods for ValidationResult.
 */
export const ValidationResult = {
  ok(): ValidationResult {
    return { valid: true, errors: [] };
  },
  fail(errors: string[]): ValidationResult {
    return { valid: false, errors };
  }
};

function requireNonEmpty(value: string | undefined | null, fieldName: string): string | undefined {
  if (!value?.trim()) {
    return `${fieldName} is required`;
  }
  return undefined;
}

function requireNonNegative(value: number | undefined, fieldName: string): string | undefined {
  if (value !== undefined && value < 0) {
    return `${fieldName} cannot be negative`;
  }
  return undefined;
}

function requireNonNegativeInteger(value: number | undefined, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value)) {
    return `${fieldName} must be an integer`;
  }
  return requireNonNegative(value, fieldName);
}

function requirePositive(value: number | undefined, fieldName: string): string | undefined {
  if (value === undefined || value <= 0) {
    return `${fieldName} must be greater than zero`;
  }
  return undefined;
}

function requireValidUrl(value: string | undefined, fieldName: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return `${fieldName} must be a valid URL`;
    }
    return undefined;
  } catch {
    return `${fieldName} must be a valid URL`;
  }
}

function requireMinLength(value: string | undefined, min: number, fieldName: string): string | undefined {
  if (value && value.length < min) {
    return `${fieldName} must be at least ${min} characters`;
  }
  return undefined;
}

function collectErrors(...checks: (string | undefined)[]): ValidationResult {
  const errors = checks.filter((c): c is string => c !== undefined);
  return errors.length > 0 ? ValidationResult.fail(errors) : ValidationResult.ok();
}

function requireOneOf(value: string, allowed: string[], fieldName: string): string | undefined {
  if (!allowed.includes(value)) {
    return `${fieldName} must be one of: ${allowed.join(", ")}`;
  }
  return undefined;
}

/**
 * Validates input for creating a contest.
 */
export class CreateContestValidator {
  validate(input: { id: string; name: string }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.id, "ID"),
      requireNonEmpty(input.name, "Name"),
      requireMinLength(input.name, 1, "Name")
    );
  }
}

/**
 * Validates input for creating a subject.
 */
export class CreateSubjectValidator {
  validate(input: { id: string; name: string; plannedStudyMinutes: number }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.id, "ID"),
      requireNonEmpty(input.name, "Name"),
      requireNonNegative(input.plannedStudyMinutes, "Planned study minutes")
    );
  }
}

/**
 * Validates input for creating a study item.
 */
export class CreateStudyItemValidator {
  validate(input: { subjectId: string; title: string; weight?: number; questionCount?: number; totalPages?: number }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.subjectId, "Subject ID"),
      requireNonEmpty(input.title, "Title"),
      requireNonNegative(input.weight, "Weight"),
      requireNonNegative(input.questionCount, "Question count"),
      requireNonNegative(input.totalPages, "Total pages")
    );
  }
}

/**
 * Validates input for creating a topic.
 */
export class CreateTopicValidator {
  validate(input: { id: string; subjectId: string; name: string }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.id, "ID"),
      requireNonEmpty(input.subjectId, "Subject ID"),
      requireNonEmpty(input.name, "Name")
    );
  }
}

/**
 * Validates input for registering a study session.
 */
export class RegisterStudySessionValidator {
  validate(input: { id: string; contestId: string; type: string; studiedAt: string; pagesOrCount?: number }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.id, "ID"),
      requireNonEmpty(input.contestId, "Contest ID"),
      requireNonEmpty(input.type, "Type"),
      requireNonEmpty(input.studiedAt, "Studied at"),
      input.type === "questions"
        ? requirePositive(input.pagesOrCount, "Questions count")
        : undefined
    );
  }
}

/**
 * Validates input for reordering subjects.
 */
export class ReorderSubjectsValidator {
  validate(input: { contestId: string; subjectIdsInOrder: string[] }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.contestId, "Contest ID"),
      input.subjectIdsInOrder.length === 0 ? "Subject order list cannot be empty" : undefined
    );
  }
}

/**
 * Validates input for setting the active contest.
 */
export class SetActiveContestValidator {
  validate(input: { contestId: string }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.contestId, "Contest ID")
    );
  }
}

/**
 * Validates input for setting a subject's active state.
 */
export class SetSubjectActiveStateValidator {
  validate(input: { subjectId: string; isActive: boolean }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.subjectId, "Subject ID")
    );
  }
}

/**
 * Validates input for updating a subject's configuration.
 */
export class UpdateSubjectConfigurationValidator {
  validate(input: { subjectId: string; plannedStudyMinutes?: number; currentStage?: string }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.subjectId, "Subject ID"),
      requireNonNegative(input.plannedStudyMinutes, "Planned study minutes")
    );
  }
}

/**
 * Validates input for deleting a study session.
 */
export class DeleteStudySessionValidator {
  validate(input: { sessionId: string }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.sessionId, "Session ID")
    );
  }
}

/**
 * Validates input for adding a resource reference to a study item.
 */
export class AddStudyItemResourceReferenceValidator {
  validate(input: { studyItemId: string; resourceReference: { id: string; title: string; type: string } }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.studyItemId, "Study item ID"),
      requireNonEmpty(input.resourceReference.id, "Resource reference ID"),
      requireNonEmpty(input.resourceReference.title, "Resource reference title"),
      requireNonEmpty(input.resourceReference.type, "Resource reference type"),
      requireOneOf(input.resourceReference.type, ["pdf", "video", "link"], "Resource reference type")
    );
  }
}

/**
 * Validates input for linking a question notebook.
 */
export class LinkQuestionNotebookValidator {
  validate(input: { topicId: string; questionNotebook: { id: string; name: string; url: string } }): ValidationResult {
    return collectErrors(
      requireNonEmpty(input.topicId, "Topic ID"),
      requireNonEmpty(input.questionNotebook.id, "Question notebook ID"),
      requireNonEmpty(input.questionNotebook.name, "Question notebook name"),
      requireNonEmpty(input.questionNotebook.url, "Question notebook URL")
    );
  }
}

/**
 * Validates input for updating a contest's wall.
 */
export class UpdateContestWallValidator {
  validate(input: { contestId: string; wall?: Wall }): ValidationResult {
    const wallLinks = [
      ...(input.wall?.noticeLinks ?? []),
      ...(input.wall?.examLinks ?? [])
    ];

    return collectErrors(
      requireNonEmpty(input.contestId, "Contest ID"),
      ...wallLinks.map((link) => requireValidUrl(link.url, "Wall link URL"))
    );
  }
}
