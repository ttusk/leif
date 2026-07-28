import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { Resource } from "@/domain/entities/Resource";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

export interface DeleteResourceInput {
  resourceId: string;
}

export class DeleteResourceUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    _repositoryFactory?: RepositoryFactory
  ) {}

  async execute(input: DeleteResourceInput): Promise<Resource> {
    if (!input.resourceId?.trim()) {
      throw new ValidationError("resourceId is required");
    }

    return this.dataStore.mutate((draft) => {
      const index = draft.resources.findIndex((resource) => resource.id === input.resourceId);
      if (index === -1) {
        throw new NotFoundError("resources", input.resourceId);
      }
      const [resource] = draft.resources.splice(index, 1);
      const subject = draft.subjects.find((entry) => entry.id === resource.subjectId);
      if (subject) {
        subject.resourceIds = subject.resourceIds.filter((id) => id !== resource.id);
      }
      return resource;
    });
  }
}
