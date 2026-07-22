import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { StudySession } from "@/domain/entities/StudySession";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import { StudySessionType } from "@/domain/entities/StudySession";

export interface UpdateStudySessionInput {
  sessionId: string;
  pagesOrCount?: number;
  correctAnswers?: number;
}

/**
 * Use case for updating a study session's progress.
 */
export class UpdateStudySessionUseCase {
  private readonly sessionRepository: EntityRepositoryPort<StudySession>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.sessionRepository = repositoryFactory.for("studySessions");
  }

  async execute(input: UpdateStudySessionInput): Promise<StudySession> {
    if (!input.sessionId?.trim()) {
      throw new ValidationError("sessionId is required");
    }
    if (input.pagesOrCount !== undefined && input.pagesOrCount < 0) {
      throw new ValidationError("pagesOrCount cannot be negative");
    }
    if (input.correctAnswers !== undefined && input.correctAnswers < 0) {
      throw new ValidationError("correctAnswers cannot be negative");
    }

    return this.dataStore.mutate((data) => {
      const sessionIndex = data.studySessions.findIndex(
        (session) => session.id === input.sessionId
      );
      if (sessionIndex === -1) throw new NotFoundError("studySessions", input.sessionId);
      const session = data.studySessions[sessionIndex];
      const newCount = input.pagesOrCount !== undefined ? input.pagesOrCount : session.pagesOrCount;
      const newCorrect =
        input.correctAnswers !== undefined ? input.correctAnswers : session.correctAnswers;

      if (newCorrect !== undefined && newCount !== undefined && newCorrect > newCount) {
        throw new ValidationError("correctAnswers cannot exceed pagesOrCount");
      }

      const updated = {
        ...session,
        pagesOrCount: newCount,
        correctAnswers: newCorrect
      };
      data.studySessions[sessionIndex] = updated;

      if (session.type === StudySessionType.QUESTIONS && session.topicId) {
        const topicIndex = data.topics.findIndex((topic) => topic.id === session.topicId);
        const topic = data.topics[topicIndex];
        if (topic?.questionNotebook) {
          data.topics[topicIndex] = {
            ...topic,
            questionNotebook: {
              ...topic.questionNotebook,
              solvedQuestions: Math.max(
                0,
                topic.questionNotebook.solvedQuestions +
                  (newCount ?? 0) -
                  (session.pagesOrCount ?? 0)
              ),
              correctAnswers: Math.max(
                0,
                topic.questionNotebook.correctAnswers +
                  (newCorrect ?? 0) -
                  (session.correctAnswers ?? 0)
              )
            }
          };
        }
      }
      return updated;
    });
  }
}
