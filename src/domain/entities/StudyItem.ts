import { ValidationError } from "@/domain/errors/DomainErrors";
import type { ResourceReference } from "@/domain/entities/ResourceReference";

/**
 * Represents a study item under a subject.
 */
export class StudyItem {
  constructor(
    public readonly id: string,
    public readonly subjectId: string,
    public readonly title: string,
    public readonly order: number,
    public readonly weight?: number,
    public readonly questionCount?: number,
    public readonly resourceReferences?: ResourceReference[],
    public readonly totalPages?: number
  ) {
    if (!id?.trim()) throw new ValidationError("StudyItem ID is required");
    if (!subjectId?.trim()) throw new ValidationError("StudyItem subjectId is required");
    if (!title?.trim()) throw new ValidationError("StudyItem title is required");
    if (order < 0) throw new ValidationError("StudyItem order cannot be negative");
    if (weight !== undefined && weight < 0)
      throw new ValidationError("StudyItem weight cannot be negative");
    if (questionCount !== undefined && questionCount < 0)
      throw new ValidationError("StudyItem questionCount cannot be negative");
    if (totalPages !== undefined && totalPages < 0)
      throw new ValidationError("StudyItem totalPages cannot be negative");
  }
}
