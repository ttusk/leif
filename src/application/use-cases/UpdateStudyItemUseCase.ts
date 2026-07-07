import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { StudyItem } from "@/domain/entities/StudyItem";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { UpdateStudyItemValidator } from "@/application/validation/InputValidators";

export interface UpdateStudyItemInput {
  itemId: string;
  title?: string;
  weight?: number;
  questionCount?: number;
  totalPages?: number;
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
    this.itemRepository = repositoryFactory.for<StudyItem>("studyItems");
  }

  async execute(input: UpdateStudyItemInput): Promise<StudyItem> {
    const validation = new UpdateStudyItemValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return await this.itemRepository.update(input.itemId, (item) => ({
      ...item,
      title: input.title !== undefined ? input.title.trim() : item.title,
      weight: input.weight !== undefined ? input.weight : item.weight,
      questionCount: input.questionCount !== undefined ? input.questionCount : item.questionCount,
      totalPages: input.totalPages !== undefined ? input.totalPages : item.totalPages
    }));
  }
}
