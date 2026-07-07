import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { ResourceReference } from "@/domain/entities/ResourceReference";
import type { StudyItem } from "@/domain/entities/StudyItem";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { AddStudyItemResourceReferenceValidator } from "@/application/validation/InputValidators";

export interface AddStudyItemResourceReferenceInput {
  studyItemId: string;
  resourceReference: ResourceReference;
}

/**
 * Use case for adding a resource reference to a study item.
 */
export class AddStudyItemResourceReferenceUseCase {
  private readonly studyItemRepository: EntityRepositoryPort<StudyItem>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.studyItemRepository = repositoryFactory.for("studyItems");
  }

  async execute(input: AddStudyItemResourceReferenceInput): Promise<StudyItem> {
    const validation = new AddStudyItemResourceReferenceValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return await this.studyItemRepository.update(input.studyItemId, (studyItem) => ({
      ...studyItem,
      resourceReferences: [...(studyItem.resourceReferences ?? []), input.resourceReference]
    }));
  }
}