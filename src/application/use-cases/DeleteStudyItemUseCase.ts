import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { StudyItem } from "@/domain/entities/StudyItem";
import type { Subject } from "@/domain/entities/Subject";

export interface DeleteStudyItemInput {
  itemId: string;
}

/**
 * Use case for deleting a study item.
 */
export class DeleteStudyItemUseCase {
  private readonly itemRepository: EntityRepositoryPort<StudyItem>;
  private readonly subjectRepository: EntityRepositoryPort<Subject>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.itemRepository = repositoryFactory.for<StudyItem>("studyItems");
    this.subjectRepository = repositoryFactory.for<Subject>("subjects");
  }

  async execute(input: DeleteStudyItemInput): Promise<StudyItem> {
    const item = await this.itemRepository.findById(input.itemId);
    await this.itemRepository.delete(input.itemId);
    await this.subjectRepository.update(item.subjectId, (subject) => ({
      ...subject,
      itemIds: subject.itemIds.filter((id) => id !== input.itemId)
    }));
    return item;
  }
}
