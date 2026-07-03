import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { StudySession } from "@/domain/entities/StudySession";
import type { Topic } from "@/domain/entities/Topic";
import { ValidationError } from "@/domain/errors/DomainErrors";
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
    this.sessionRepository = repositoryFactory.for<StudySession>("studySessions");
    this.topicRepository = repositoryFactory.for<Topic>("topics");
  }

  async execute(input: DeleteStudySessionInput): Promise<StudySession> {
    const validation = new DeleteStudySessionValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    const session = await this.sessionRepository.findById(input.sessionId);

    await this.updateTopicQuestionNotebookStats(session);

    await this.sessionRepository.delete(input.sessionId);

    return session;
  }

  private async updateTopicQuestionNotebookStats(session: StudySession): Promise<void> {
    if (session.type !== "questions" || !session.topicId) {
      return;
    }

    await this.topicRepository.update(session.topicId, (topic) => {
      if (!topic.questionNotebook) {
        return topic;
      }

      return {
        ...topic,
        questionNotebook: {
          ...topic.questionNotebook,
          solvedQuestions: Math.max(0, topic.questionNotebook.solvedQuestions - (session.pagesOrCount ?? 0)),
          correctAnswers: Math.max(0, topic.questionNotebook.correctAnswers - (session.correctAnswers ?? 0))
        }
      };
    });
  }
}