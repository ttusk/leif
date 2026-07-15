import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { ResourceReference } from "@/domain/entities/ResourceReference";
import type { StudyItem } from "@/domain/entities/StudyItem";
import { ValidationError } from "@/domain/errors/DomainErrors";

export interface UpdateStudyItemInput {
  itemId: string;
  title?: string;
  weight?: number;
  questionCount?: number;
  totalPages?: number;
  resourceReferences?: ResourceReference[];
}

/**
 * Use case for updating a study item's configuration.
 */
export class UpdateStudyItemUseCase {
  private readonly itemRepository: EntityRepositoryPort<StudyItem>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.itemRepository = repositoryFactory.for("studyItems");
  }

  async execute(input: UpdateStudyItemInput): Promise<StudyItem> {
    if (!input.itemId?.trim()) {
      throw new ValidationError("itemId is required");
    }
    if (input.title !== undefined && !input.title.trim()) {
      throw new ValidationError("title is required");
    }
    if (input.weight !== undefined && input.weight < 0) {
      throw new ValidationError("weight cannot be negative");
    }
    if (input.questionCount !== undefined && input.questionCount < 0) {
      throw new ValidationError("questionCount cannot be negative");
    }
    if (input.totalPages !== undefined && input.totalPages < 0) {
      throw new ValidationError("totalPages cannot be negative");
    }

    return await this.itemRepository.update(input.itemId, (item) => ({
      ...item,
      title: input.title !== undefined ? input.title.trim() : item.title,
      weight: input.weight !== undefined ? input.weight : item.weight,
      questionCount: input.questionCount !== undefined ? input.questionCount : item.questionCount,
      totalPages: input.totalPages !== undefined ? input.totalPages : item.totalPages,
      resourceReferences: input.resourceReferences !== undefined
        ? input.resourceReferences
        : item.resourceReferences
    }));
  }
}
