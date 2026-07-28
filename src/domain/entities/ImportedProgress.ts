import { ValidationError } from "@/domain/errors/DomainErrors";

/**
 * Progress imported from a source that cannot be reconstructed as study
 * records (for example legacy question-notebook counters). The baseline is
 * added to record-derived progress so existing records are not double-counted.
 */
export class ImportedProgress {
  constructor(
    public readonly quantity: number,
    public readonly correctAnswers?: number
  ) {
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new ValidationError("ImportedProgress quantity cannot be negative");
    }
    if (correctAnswers !== undefined) {
      if (!Number.isFinite(correctAnswers) || correctAnswers < 0) {
        throw new ValidationError("ImportedProgress correctAnswers cannot be negative");
      }
      if (correctAnswers > quantity) {
        throw new ValidationError("ImportedProgress correctAnswers cannot exceed quantity");
      }
    }
  }
}
