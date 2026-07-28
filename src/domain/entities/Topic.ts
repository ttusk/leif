import { ValidationError } from "@/domain/errors/DomainErrors";

/**
 * Assunto: an atomic syllabus topic studied within a Matéria.
 */
export class Topic {
  constructor(
    public readonly id: string,
    public readonly subjectId: string,
    public readonly name: string
  ) {
    if (!id?.trim()) throw new ValidationError("Topic ID is required");
    if (!subjectId?.trim()) throw new ValidationError("Topic subjectId is required");
    if (!name?.trim()) throw new ValidationError("Topic name is required");
  }
}
