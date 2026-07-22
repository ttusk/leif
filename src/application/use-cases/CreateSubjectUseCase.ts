import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import { Subject } from "@/domain/entities/Subject";
import { Contest } from "@/domain/entities/Contest";
import { AlreadyExistsError, NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import { CreateSubjectValidator } from "@/application/validation/InputValidators";

export interface CreateSubjectInput {
  id: string;
  contestId: string;
  name: string;
  plannedStudyMinutes: number;
  isActive?: boolean;
  currentStage?: string;
}

/**
 * Use case for creating a new subject under a contest.
 */
export class CreateSubjectUseCase {
  private readonly contestRepository: EntityRepositoryPort<Contest>;
  private readonly subjectRepository: EntityRepositoryPort<Subject>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.contestRepository = repositoryFactory.for("contests");
    this.subjectRepository = repositoryFactory.for("subjects");
  }

  async execute(input: CreateSubjectInput): Promise<Subject> {
    const validation = new CreateSubjectValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((data) => {
      const contest = data.contests.find((candidate) => candidate.id === input.contestId);
      if (!contest) throw new NotFoundError("contests", input.contestId);
      if (data.subjects.some((subject) => subject.id === input.id)) {
        throw new AlreadyExistsError("subjects", input.id);
      }

      const contestSubjects = data.subjects.filter(
        (subject) => subject.contestId === input.contestId
      );
      const nextOrder =
        contestSubjects.length === 0
          ? 1
          : Math.max(...contestSubjects.map((subject) => subject.order)) + 1;
      const subject = new Subject(
        input.id,
        input.contestId,
        input.name,
        nextOrder,
        input.isActive ?? true,
        input.plannedStudyMinutes,
        input.currentStage,
        [],
        []
      );
      data.subjects.push(subject);
      const contestIndex = data.contests.indexOf(contest);
      data.contests[contestIndex] = {
        ...contest,
        subjectIds: [...contest.subjectIds, subject.id]
      };
      return subject;
    });
  }
}
