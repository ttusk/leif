import { ValidationError } from "@/domain/errors/DomainErrors";
import { Mural } from "@/domain/entities/Mural";

export interface ContestExamPlan {
  examDate?: string;
  board?: string;
  weeklyStudyHours?: number;
  weeklyQuestionGoal?: number;
}

/**
 * Concurso: the exam or selection process whose study plan Leif organizes.
 */
export class Contest {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly subjectIds: string[] = [],
    public readonly mural: Mural = new Mural(),
    public readonly examPlan?: ContestExamPlan
  ) {
    if (!id?.trim()) throw new ValidationError("Contest ID is required");
    if (!name?.trim()) throw new ValidationError("Contest name is required");
  }
}
