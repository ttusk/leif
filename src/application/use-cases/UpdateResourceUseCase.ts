import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { Resource } from "@/domain/entities/Resource";
import type { ResourceAccess } from "@/domain/entities/ResourceAccess";
import type { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

export interface UpdateResourceInput {
  resourceId: string;
  title?: string;
  format?: string;
  goal?: ResourceGoal | null;
  completed?: boolean;
  topicIds?: string[];
  accesses?: ResourceAccess[];
}

export class UpdateResourceUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    _repositoryFactory?: RepositoryFactory
  ) {}

  async execute(input: UpdateResourceInput): Promise<Resource> {
    if (!input.resourceId?.trim()) {
      throw new ValidationError("resourceId is required");
    }
    if (input.title !== undefined && !input.title.trim()) {
      throw new ValidationError("title is required");
    }

    return this.dataStore.mutate((draft) => {
      const index = draft.resources.findIndex((resource) => resource.id === input.resourceId);
      if (index === -1) {
        throw new NotFoundError("resources", input.resourceId);
      }
      const current = draft.resources[index];
      const topicIds = input.topicIds ?? current.topicIds;
      const validTopicIds = new Set(
        draft.topics
          .filter((topic) => topic.subjectId === current.subjectId)
          .map((topic) => topic.id)
      );
      const invalidTopicId = topicIds.find((topicId) => !validTopicIds.has(topicId));
      if (invalidTopicId) {
        throw new ValidationError(
          `topicId "${invalidTopicId}" must belong to the selected subject`
        );
      }

      const updated = new Resource(
        current.id,
        current.subjectId,
        input.title?.trim() ?? current.title,
        current.order,
        input.format ?? current.format,
        input.goal === null ? undefined : (input.goal ?? current.goal),
        input.completed ?? current.completed,
        [...topicIds],
        input.accesses ?? current.accesses,
        current.baseline
      );
      draft.resources[index] = updated;
      return updated;
    });
  }
}
