import { Subject } from "@/domain/entities/Subject";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateSubjectValidator } from "@/application/validation/InputValidators";

export interface CreateSubjectInput {
  id: string;
  contestId: string;
  name: string;
  plannedStudyMinutes: number;
  isActive?: boolean;
  currentStage?: string;
}

export class CreateSubjectUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    _repositoryFactory?: RepositoryFactory
  ) {}

  async execute(input: CreateSubjectInput): Promise<Subject> {
    const validation = new CreateSubjectValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((draft) => {
      const contest = draft.contests.find((entry) => entry.id === input.contestId);
      if (!contest) {
        throw new NotFoundError("contests", input.contestId);
      }
      if (draft.subjects.some((subject) => subject.id === input.id)) {
        throw new ValidationError(`Subject "${input.id}" already exists.`);
      }

      const contestSubjects = draft.subjects.filter(
        (subject) => subject.contestId === input.contestId
      );
      const nextOrder =
        contestSubjects.reduce((max, subject) => Math.max(max, subject.order), 0) + 1;

      const subject = new Subject(
        input.id,
        input.contestId,
        input.name,
        nextOrder,
        input.isActive ?? true,
        input.plannedStudyMinutes,
        input.currentStage
      );

      draft.subjects.push(subject);
      contest.subjectIds.push(subject.id);

      return subject;
    });
  }
}
