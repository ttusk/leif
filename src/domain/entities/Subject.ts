import { ValidationError } from "@/domain/errors/DomainErrors";

/**
 * Represents a subject within a contest.
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
    public readonly itemIds: string[] = [],
    public readonly topicIds: string[] = []
  ) {
    if (!id?.trim()) throw new ValidationError("Subject ID is required");
    if (!contestId?.trim()) throw new ValidationError("Subject contestId is required");
    if (!name?.trim()) throw new ValidationError("Subject name is required");
    if (order < 0) throw new ValidationError("Subject order cannot be negative");
    if (plannedStudyMinutes < 0)
      throw new ValidationError("Subject plannedStudyMinutes cannot be negative");
  }
}
