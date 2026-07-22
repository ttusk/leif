import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { StudySession } from "@/domain/entities/StudySession";
import { StudySessionType } from "@/domain/entities/StudySession";
import type { Topic } from "@/domain/entities/Topic";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import { DeleteStudySessionValidator } from "@/application/validation/InputValidators";

export interface DeleteStudySessionInput {
  sessionId: string;
}

/**
 * Use case for deleting a study session.
 */
export class DeleteStudySessionUseCase {
  private readonly sessionRepository: EntityRepositoryPort<StudySession>;
  private readonly topicRepository: EntityRepositoryPort<Topic>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.sessionRepository = repositoryFactory.for("studySessions");
    this.topicRepository = repositoryFactory.for("topics");
  }

  async execute(input: DeleteStudySessionInput): Promise<StudySession> {
    const validation = new DeleteStudySessionValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((data) => {
      const sessionIndex = data.studySessions.findIndex(
        (session) => session.id === input.sessionId
      );
      if (sessionIndex === -1) throw new NotFoundError("studySessions", input.sessionId);
      const session = data.studySessions[sessionIndex];
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
                topic.questionNotebook.solvedQuestions - (session.pagesOrCount ?? 0)
              ),
              correctAnswers: Math.max(
                0,
                topic.questionNotebook.correctAnswers - (session.correctAnswers ?? 0)
              )
            }
          };
        }
      }
      data.studySessions.splice(sessionIndex, 1);
      return session;
    });
  }
}
