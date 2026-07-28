import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { createLeifId } from "@/application/Id";
import { CreateResourceValidator } from "@/application/validation/InputValidators";
import { Resource } from "@/domain/entities/Resource";
import type { ImportedProgress } from "@/domain/entities/ImportedProgress";
import type { ResourceAccess } from "@/domain/entities/ResourceAccess";
import type { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { AlreadyExistsError, NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

export interface CreateResourceInput {
  id?: string;
  subjectId: string;
  title: string;
  format?: string;
  goal?: ResourceGoal;
  completed?: boolean;
  topicIds?: string[];
  accesses?: ResourceAccess[];
  baseline?: ImportedProgress;
}

export class CreateResourceUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    _repositoryFactory?: RepositoryFactory
  ) {}

  async execute(input: CreateResourceInput): Promise<Resource> {
    const validation = new CreateResourceValidator().validate({
      ...input,
      goalAmount: input.goal?.amount,
      goalUnit: input.goal?.unit
    });
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((draft) => {
      const subject = draft.subjects.find((entry) => entry.id === input.subjectId);
      if (!subject) {
        throw new NotFoundError("subjects", input.subjectId);
      }

      const id = input.id ?? createLeifId();
      if (draft.resources.some((resource) => resource.id === id)) {
        throw new AlreadyExistsError("resources", id);
      }

      const topicIds = input.topicIds ?? [];
      const topicIdsInSubject = new Set(
        draft.topics.filter((topic) => topic.subjectId === input.subjectId).map((topic) => topic.id)
      );
      const invalidTopicId = topicIds.find((topicId) => !topicIdsInSubject.has(topicId));
      if (invalidTopicId) {
        throw new ValidationError(
          `topicId "${invalidTopicId}" must belong to the selected subject`
        );
      }

      const nextOrder =
        draft.resources
          .filter((resource) => resource.subjectId === input.subjectId)
          .reduce((max, resource) => Math.max(max, resource.order), 0) + 1;
      const resource = new Resource(
        id,
        input.subjectId,
        input.title,
        nextOrder,
        input.format,
        input.goal,
        input.completed ?? false,
        topicIds,
        input.accesses ?? [],
        input.baseline
      );

      draft.resources.push(resource);
      subject.resourceIds.push(resource.id);

      return resource;
    });
  }
}
