import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { QuestionNotebook } from "@/domain/entities/QuestionNotebook";
import type { Topic } from "@/domain/entities/Topic";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { LinkQuestionNotebookValidator } from "@/application/validation/InputValidators";

export interface LinkQuestionNotebookInput {
  topicId: string;
  questionNotebook: QuestionNotebook;
}

/**
 * Use case for linking a question notebook to a topic.
 */
export class LinkQuestionNotebookUseCase {
  private readonly topicRepository: EntityRepositoryPort<Topic>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.topicRepository = repositoryFactory.for<Topic>("topics");
  }

  async execute(input: LinkQuestionNotebookInput): Promise<Topic> {
    const validation = new LinkQuestionNotebookValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return await this.topicRepository.update(input.topicId, (topic) => ({
      ...topic,
      questionNotebook: input.questionNotebook
    }));
  }
}