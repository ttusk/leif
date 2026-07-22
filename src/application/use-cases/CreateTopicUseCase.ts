import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import { Topic } from "@/domain/entities/Topic";
import { Subject } from "@/domain/entities/Subject";
import { AlreadyExistsError, NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
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
    this.topicRepository = repositoryFactory.for("topics");
    this.subjectRepository = repositoryFactory.for("subjects");
  }

  async execute(input: CreateTopicInput): Promise<Topic> {
    const validation = new CreateTopicValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((data) => {
      const subject = data.subjects.find((candidate) => candidate.id === input.subjectId);
      if (!subject) throw new NotFoundError("subjects", input.subjectId);
      if (data.topics.some((topic) => topic.id === input.id)) {
        throw new AlreadyExistsError("topics", input.id);
      }
      const topic = new Topic(input.id, input.subjectId, input.name, []);
      data.topics.push(topic);
      const subjectIndex = data.subjects.indexOf(subject);
      data.subjects[subjectIndex] = {
        ...subject,
        topicIds: [...subject.topicIds, topic.id]
      };
      return topic;
    });
  }
}
