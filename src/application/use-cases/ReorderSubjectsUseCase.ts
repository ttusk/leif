import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { Subject } from "@/domain/entities/Subject";
import type { Contest } from "@/domain/entities/Contest";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { ReorderSubjectsValidator } from "@/application/validation/InputValidators";

export interface ReorderSubjectsInput {
  contestId: string;
  subjectIdsInOrder: string[];
}

/**
 * Use case for reordering subjects within a contest.
 */
export class ReorderSubjectsUseCase {
  private readonly contestRepository: EntityRepositoryPort<Contest>;
  private readonly subjectRepository: EntityRepositoryPort<Subject>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.contestRepository = repositoryFactory.for<Contest>("contests");
    this.subjectRepository = repositoryFactory.for<Subject>("subjects");
  }

  async execute(input: ReorderSubjectsInput): Promise<Subject[]> {
    const validation = new ReorderSubjectsValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    const contest = await this.contestRepository.findById(input.contestId);

    const contestSubjects = (await this.subjectRepository.findAll())
      .filter((subject) => subject.contestId === input.contestId);

    if (contestSubjects.length !== input.subjectIdsInOrder.length) {
      throw new ValidationError("The provided subject order does not match the contest subject list.");
    }

    const subjectIdSet = new Set(contestSubjects.map((subject) => subject.id));

    for (const subjectId of input.subjectIdsInOrder) {
      if (!subjectIdSet.has(subjectId)) {
        throw new ValidationError(`Subject "${subjectId}" does not belong to contest "${input.contestId}".`);
      }
    }

    const updatedById = new Map<string, Subject>(
      input.subjectIdsInOrder.map((subjectId, index) => {
        const currentSubject = contestSubjects.find((subject) => subject.id === subjectId)!;
        return [subjectId, { ...currentSubject, order: index + 1 }];
      })
    );

    await this.contestRepository.update(input.contestId, (contest) => ({
      ...contest,
      subjectIds: [...input.subjectIdsInOrder]
    }));

    const allSubjects = await this.subjectRepository.findAll();
    const updatedSubjects = allSubjects.map((subject) => updatedById.get(subject.id) ?? subject);
    await this.subjectRepository.replaceAll(updatedSubjects);

    return input.subjectIdsInOrder.map((subjectId) => updatedById.get(subjectId)!);
  }
}