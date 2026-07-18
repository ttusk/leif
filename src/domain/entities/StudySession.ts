import { ValidationError } from "@/domain/errors/DomainErrors";

export const StudySessionType = {
  PDF: "pdf",
  VIDEO: "video",
  QUESTIONS: "questions"
} as const;

export type StudySessionType = (typeof StudySessionType)[keyof typeof StudySessionType];

/**
 * Represents a registered study session.
 */
export class StudySession {
  constructor(
    public readonly id: string,
    public readonly contestId: string,
    public readonly type: StudySessionType,
    public readonly studiedAt: string,
    public readonly subjectId?: string,
    public readonly studyItemId?: string,
    public readonly topicId?: string,
    public readonly phase?: string,
    public readonly reference?: string,
    public readonly pagesOrCount?: number,
    public readonly correctAnswers?: number,
    public readonly completed?: boolean
  ) {
    if (!id?.trim()) throw new ValidationError("StudySession ID is required");
    if (!contestId?.trim()) throw new ValidationError("StudySession contestId is required");
    if (!type) throw new ValidationError("StudySession type is required");
    if (!studiedAt?.trim()) throw new ValidationError("StudySession studiedAt is required");
    if (pagesOrCount !== undefined && pagesOrCount < 0)
      throw new ValidationError("StudySession pagesOrCount cannot be negative");
    if (correctAnswers !== undefined && correctAnswers < 0)
      throw new ValidationError("StudySession correctAnswers cannot be negative");
    if (
      correctAnswers !== undefined &&
      pagesOrCount !== undefined &&
      correctAnswers > pagesOrCount
    ) {
      throw new ValidationError("StudySession correctAnswers cannot exceed pagesOrCount");
    }
  }
}
