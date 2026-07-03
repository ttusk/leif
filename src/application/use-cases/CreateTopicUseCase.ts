import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import { Topic } from "@/domain/entities/Topic";
import { Subject } from "@/domain/entities/Subject";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { CreateTopicValidator } from "@/application/validation/InputValidators";

export interface CreateTopicInput {
  id: string;
  subjectId: string;
  name: string;
}

/**
 * Use case for creating a new topic under a subject.
 */
export class CreateTopicUseCase {
  private readonly topicRepository: EntityRepositoryPort<Topic>;
  private readonly subjectRepository: EntityRepositoryPort<Subject>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.topicRepository = repositoryFactory.for<Topic>("topics");
    this.subjectRepository = repositoryFactory.for<Subject>("subjects");
  }

  async execute(input: CreateTopicInput): Promise<Topic> {
    const validation = new CreateTopicValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    await this.subjectRepository.findById(input.subjectId);

    const topic = new Topic(
      input.id,
      input.subjectId,
      input.name,
      []
    );

    await this.topicRepository.create(topic);

    await this.subjectRepository.update(input.subjectId, (subject) => ({
      ...subject,
      topicIds: [...subject.topicIds, topic.id]
    }));

    return topic;
  }
}
