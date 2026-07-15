import { ValidationError } from "@/domain/errors/DomainErrors";
import { Wall } from "@/domain/entities/Wall";

export interface ContestExamPlan {
  examDate?: string;
  board?: string;
  weeklyStudyHours?: number;
  weeklyQuestionGoal?: number;
}

/**
 * Represents a public exam contest.
 */
export class Contest {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly subjectIds: string[] = [],
    public readonly wall: Wall = new Wall(),
    public readonly examPlan?: ContestExamPlan
  ) {
    if (!id?.trim()) throw new ValidationError("Contest ID is required");
    if (!name?.trim()) throw new ValidationError("Contest name is required");
  }
}
