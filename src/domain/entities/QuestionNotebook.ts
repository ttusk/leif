import { ValidationError } from "@/domain/errors/DomainErrors";

/**
 * Represents a question notebook linked to a topic.
 */
export class QuestionNotebook {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly url: string,
    public readonly solvedQuestions: number = 0,
    public readonly correctAnswers: number = 0,
    public readonly notes?: string
  ) {
    if (!id?.trim()) throw new ValidationError("QuestionNotebook ID is required");
    if (!name?.trim()) throw new ValidationError("QuestionNotebook name is required");
    if (!url?.trim()) throw new ValidationError("QuestionNotebook URL is required");
    if (solvedQuestions < 0) throw new ValidationError("Solved questions cannot be negative");
    if (correctAnswers < 0) throw new ValidationError("Correct answers cannot be negative");
    if (correctAnswers > solvedQuestions)
      throw new ValidationError("Correct answers cannot exceed solved questions");
  }
}
