import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { StudyItem } from "@/domain/entities/StudyItem";
import type { Subject } from "@/domain/entities/Subject";
import { EntityRepository } from "@/infrastructure/persistence/EntityRepository";

export interface DeleteStudyItemInput {
  itemId: string;
}

/**
 * Use case for deleting a study item.
 */
export class DeleteStudyItemUseCase {
  private readonly itemRepository: EntityRepository<StudyItem>;
  private readonly subjectRepository: EntityRepository<Subject>;

  constructor(private readonly dataStore: PluginDataStore) {
    this.itemRepository = new EntityRepository<StudyItem>(dataStore, "studyItems");
    this.subjectRepository = new EntityRepository<Subject>(dataStore, "subjects");
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
