import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { Subject } from "@/domain/entities/Subject";
import type { Topic } from "@/domain/entities/Topic";

export interface DeleteTopicInput {
  topicId: string;
}

/**
 * Use case for deleting a topic.
 */
export class DeleteTopicUseCase {
  private readonly topicRepository: EntityRepositoryPort<Topic>;
  private readonly subjectRepository: EntityRepositoryPort<Subject>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.topicRepository = repositoryFactory.for<Topic>("topics");
    this.subjectRepository = repositoryFactory.for<Subject>("subjects");
  }

  async execute(input: DeleteTopicInput): Promise<Topic> {
    const topic = await this.topicRepository.findById(input.topicId);
    await this.topicRepository.delete(input.topicId);
    await this.subjectRepository.update(topic.subjectId, (subject) => ({
      ...subject,
      topicIds: subject.topicIds.filter((id) => id !== input.topicId)
    }));
    return topic;
  }
}
