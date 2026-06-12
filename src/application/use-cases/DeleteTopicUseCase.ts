import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { Topic } from "@/domain/entities/Topic";
import { EntityRepository } from "@/infrastructure/persistence/EntityRepository";

export interface DeleteTopicInput {
  topicId: string;
}

/**
 * Use case for deleting a topic.
 */
export class DeleteTopicUseCase {
  private readonly topicRepository: EntityRepository<Topic>;

  constructor(private readonly dataStore: PluginDataStore) {
    this.topicRepository = new EntityRepository<Topic>(dataStore, "topics");
  }

  async execute(input: DeleteTopicInput): Promise<Topic> {
    const topic = await this.topicRepository.findById(input.topicId);
    await this.topicRepository.delete(input.topicId);
    return topic;
  }
}
