import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { Topic } from "@/domain/entities/Topic";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

export interface UpdateTopicInput {
  topicId: string;
  name?: string;
}

export class UpdateTopicUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    _repositoryFactory?: RepositoryFactory
  ) {}

  async execute(input: UpdateTopicInput): Promise<Topic> {
    if (!input.topicId?.trim()) {
      throw new ValidationError("topicId is required");
    }
    if (input.name !== undefined && !input.name.trim()) {
      throw new ValidationError("name cannot be empty");
    }

    return this.dataStore.mutate((draft) => {
      const index = draft.topics.findIndex((topic) => topic.id === input.topicId);
      if (index === -1) {
        throw new NotFoundError("topics", input.topicId);
      }
      const current = draft.topics[index];
      const updated = new Topic(current.id, current.subjectId, input.name?.trim() ?? current.name);
      draft.topics[index] = updated;
      return updated;
    });
  }
}
