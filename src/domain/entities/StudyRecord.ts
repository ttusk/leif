import { ValidationError } from "@/domain/errors/DomainErrors";
import type { GoalUnit } from "@/domain/types/GoalUnit";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Registro de estudo: an independent, dated historical fact belonging to one
 * Concurso and exactly one Matéria, optionally narrowed to one Recurso and one
 * Assunto.
 */
export class StudyRecord {
  constructor(
    public readonly id: string,
    public readonly contestId: string,
    public readonly date: string,
    public readonly subjectId: string,
    public readonly resourceId?: string,
    public readonly topicId?: string,
    public readonly quantity?: number,
    public readonly unit?: GoalUnit,
    public readonly correctAnswers?: number,
    public readonly completed: boolean = false,
    public readonly notes?: string
  ) {
    if (!id?.trim()) throw new ValidationError("StudyRecord ID is required");
    if (!contestId?.trim()) throw new ValidationError("StudyRecord contestId is required");
    if (!date?.trim() || !DATE_PATTERN.test(date)) {
      throw new ValidationError("StudyRecord date must use YYYY-MM-DD");
    }
    if (!subjectId?.trim()) throw new ValidationError("StudyRecord subjectId is required");
    if (quantity !== undefined) {
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new ValidationError("StudyRecord quantity cannot be negative");
      }
      if (unit === undefined) {
        throw new ValidationError("StudyRecord quantity requires a unit");
      }
    }
    if (unit !== undefined && quantity === undefined) {
      throw new ValidationError("StudyRecord unit requires a quantity");
    }
    if (correctAnswers !== undefined) {
      if (!Number.isFinite(correctAnswers) || correctAnswers < 0) {
        throw new ValidationError("StudyRecord correctAnswers cannot be negative");
      }
      if (quantity === undefined) {
        throw new ValidationError("StudyRecord correctAnswers requires a quantity");
      }
      if (correctAnswers > quantity) {
        throw new ValidationError("StudyRecord correctAnswers cannot exceed quantity");
      }
    }
  }
}
