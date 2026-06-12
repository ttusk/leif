import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { StudyItem } from "@/domain/entities/StudyItem";
import { EntityRepository } from "@/infrastructure/persistence/EntityRepository";

export interface DeleteStudyItemInput {
  itemId: string;
}

/**
 * Use case for deleting a study item.
 */
export class DeleteStudyItemUseCase {
  private readonly itemRepository: EntityRepository<StudyItem>;

  constructor(private readonly dataStore: PluginDataStore) {
    this.itemRepository = new EntityRepository<StudyItem>(dataStore, "studyItems");
  }

  async execute(input: DeleteStudyItemInput): Promise<StudyItem> {
    const item = await this.itemRepository.findById(input.itemId);
    await this.itemRepository.delete(input.itemId);
    return item;
  }
}
