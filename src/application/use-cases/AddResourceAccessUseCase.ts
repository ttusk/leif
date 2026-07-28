import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { AddResourceAccessValidator } from "@/application/validation/InputValidators";
import { Resource } from "@/domain/entities/Resource";
import { ResourceAccess } from "@/domain/entities/ResourceAccess";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

export interface AddResourceAccessInput {
  resourceId: string;
  title: string;
  url: string;
  notes?: string;
}

export class AddResourceAccessUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    _repositoryFactory?: RepositoryFactory
  ) {}

  async execute(input: AddResourceAccessInput): Promise<Resource> {
    const validation = new AddResourceAccessValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((draft) => {
      const index = draft.resources.findIndex((resource) => resource.id === input.resourceId);
      if (index === -1) {
        throw new NotFoundError("resources", input.resourceId);
      }
      const current = draft.resources[index];
      const updated = new Resource(
        current.id,
        current.subjectId,
        current.title,
        current.order,
        current.format,
        current.goal,
        current.completed,
        [...current.topicIds],
        [...current.accesses, new ResourceAccess(input.title, input.url, input.notes)],
        current.baseline
      );
      draft.resources[index] = updated;
      return updated;
    });
  }
}
