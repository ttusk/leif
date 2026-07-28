import { ValidationError } from "@/domain/errors/DomainErrors";
import type { GoalUnit } from "@/domain/types/GoalUnit";

/**
 * Documented initial values for the extensible `activity` vocabulary.
 */
export const StudyActivity = {
  LEITURA: "leitura",
  VIDEO: "video",
  QUESTOES: "questoes",
  REVISAO: "revisao",
  OUTRO: "outro"
} as const;

export type KnownStudyActivity = (typeof StudyActivity)[keyof typeof StudyActivity];

/**
 * Registro de estudo: one measured study activity within a Sessão de estudo
 * for exactly one Matéria, optionally narrowed to one Recurso and one Assunto.
 */
export class StudyRecord {
  constructor(
    public readonly id: string,
    public readonly subjectId: string,
    public readonly activity: string,
    public readonly resourceId?: string,
    public readonly topicId?: string,
    public readonly quantity?: number,
    public readonly unit?: GoalUnit,
    public readonly correctAnswers?: number,
    public readonly completed: boolean = false,
    public readonly notes?: string
  ) {
    if (!id?.trim()) throw new ValidationError("StudyRecord ID is required");
    if (!subjectId?.trim()) throw new ValidationError("StudyRecord subjectId is required");
    if (!activity?.trim()) throw new ValidationError("StudyRecord activity is required");
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
