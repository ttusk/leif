import { ValidationError } from "@/domain/errors/DomainErrors";

/**
 * Matéria: a major area of knowledge in a Concurso and one step in its study
 * cycle. Contains ordered Recursos and ordered Assuntos as sibling collections.
 */
export class Subject {
  constructor(
    public readonly id: string,
    public readonly contestId: string,
    public readonly name: string,
    public readonly order: number,
    public readonly isActive: boolean = true,
    public readonly plannedStudyMinutes: number = 0,
    public readonly currentStage?: string,
    public readonly resourceIds: string[] = [],
    public readonly topicIds: string[] = []
  ) {
    if (!id?.trim()) throw new ValidationError("Subject ID is required");
    if (!contestId?.trim()) throw new ValidationError("Subject contestId is required");
    if (!name?.trim()) throw new ValidationError("Subject name is required");
    if (!Number.isInteger(order) || order < 1) {
      throw new ValidationError("Subject order must be a positive integer");
    }
    if (plannedStudyMinutes < 0) {
      throw new ValidationError("Subject plannedStudyMinutes cannot be negative");
    }
  }
}
