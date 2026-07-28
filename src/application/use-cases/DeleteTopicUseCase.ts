import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import type { Topic } from "@/domain/entities/Topic";
import { NotFoundError } from "@/domain/errors/DomainErrors";

export interface DeleteTopicInput {
  topicId: string;
}

/**
 * Use case for deleting a topic.
 */
export class DeleteTopicUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    _repositoryFactory: RepositoryFactory
  ) {}

  async execute(input: DeleteTopicInput): Promise<Topic> {
    return this.dataStore.mutate((draft) => {
      const index = draft.topics.findIndex((topic) => topic.id === input.topicId);
      if (index === -1) {
        throw new NotFoundError("topics", input.topicId);
      }
      const [topic] = draft.topics.splice(index, 1);
      const subject = draft.subjects.find((entry) => entry.id === topic.subjectId);
      if (subject) {
        subject.topicIds = subject.topicIds.filter((id) => id !== input.topicId);
      }
      draft.resources.forEach((resource) => {
        resource.topicIds = resource.topicIds.filter((id) => id !== input.topicId);
      });
      return topic;
    });
  }
}
