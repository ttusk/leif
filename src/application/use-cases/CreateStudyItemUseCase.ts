import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { ResourceReference } from "@/domain/entities/ResourceReference";
import { StudyItem } from "@/domain/entities/StudyItem";
import { Subject } from "@/domain/entities/Subject";
import { AlreadyExistsError, NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import { CreateStudyItemValidator } from "@/application/validation/InputValidators";
import { createId } from "@/application/Id";

export interface CreateStudyItemInput {
  id?: string;
  subjectId: string;
  title: string;
  weight?: number;
  questionCount?: number;
  resourceReferences?: ResourceReference[];
  totalPages?: number;
}

/**
 * Use case for creating a new study item under a subject.
 */
export class CreateStudyItemUseCase {
  private readonly subjectRepository: EntityRepositoryPort<Subject>;
  private readonly studyItemRepository: EntityRepositoryPort<StudyItem>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.subjectRepository = repositoryFactory.for("subjects");
    this.studyItemRepository = repositoryFactory.for("studyItems");
  }

  async execute(input: CreateStudyItemInput): Promise<StudyItem> {
    const validation = new CreateStudyItemValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((data) => {
      const subject = data.subjects.find((candidate) => candidate.id === input.subjectId);
      if (!subject) throw new NotFoundError("subjects", input.subjectId);
      const id = input.id ?? createId("item");
      if (data.studyItems.some((item) => item.id === id)) {
        throw new AlreadyExistsError("studyItems", id);
      }
      const subjectItems = data.studyItems.filter((item) => item.subjectId === input.subjectId);
      const nextItem = new StudyItem(
        id,
        input.subjectId,
        input.title,
        subjectItems.length + 1,
        input.weight,
        input.questionCount,
        input.resourceReferences ?? [],
        input.totalPages
      );
      data.studyItems.push(nextItem);
      const subjectIndex = data.subjects.indexOf(subject);
      data.subjects[subjectIndex] = {
        ...subject,
        itemIds: [...subject.itemIds, nextItem.id]
      };
      return nextItem;
    });
  }
}
