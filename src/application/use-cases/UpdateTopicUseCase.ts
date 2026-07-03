import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { QuestionNotebook } from "@/domain/entities/QuestionNotebook";
import type { Topic } from "@/domain/entities/Topic";
import { ValidationError } from "@/domain/errors/DomainErrors";

export interface UpdateTopicInput {
  topicId: string;
  name?: string;
  questionNotebook?: {
    id: string;
    name: string;
    url: string;
    solvedQuestions?: number;
    correctAnswers?: number;
  };
}

/**
 * Use case for updating a topic's configuration.
 */
export class UpdateTopicUseCase {
  private readonly topicRepository: EntityRepositoryPort<Topic>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.topicRepository = repositoryFactory.for<Topic>("topics");
  }

  async execute(input: UpdateTopicInput): Promise<Topic> {
    if (!input.topicId?.trim()) {
      throw new ValidationError("topicId is required");
    }
    if (input.name !== undefined && !input.name.trim()) {
      throw new ValidationError("name cannot be empty");
    }

    return await this.topicRepository.update(input.topicId, (topic) => {
      let notebook: QuestionNotebook | undefined = topic.questionNotebook;

      if (input.questionNotebook) {
        const solved = input.questionNotebook.solvedQuestions ?? notebook?.solvedQuestions ?? 0;
        const correct = input.questionNotebook.correctAnswers ?? notebook?.correctAnswers ?? 0;

        if (correct > solved) {
          throw new ValidationError("correctAnswers cannot exceed solvedQuestions");
        }

        notebook = new QuestionNotebook(
          input.questionNotebook.id,
          input.questionNotebook.name,
          input.questionNotebook.url,
          solved,
          correct,
          notebook?.notes
        );
      }

      return {
        ...topic,
        name: input.name ?? topic.name,
        questionNotebook: notebook
      };
    });
  }
}
