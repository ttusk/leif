import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { Subject } from "@/domain/entities/Subject";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { UpdateSubjectConfigurationValidator } from "@/application/validation/InputValidators";

export interface UpdateSubjectConfigurationInput {
  subjectId: string;
  plannedStudyMinutes?: number;
  currentStage?: string;
}

/**
 * Use case for updating a subject's configuration.
 */
export class UpdateSubjectConfigurationUseCase {
  private readonly subjectRepository: EntityRepositoryPort<Subject>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.subjectRepository = repositoryFactory.for<Subject>("subjects");
  }

  async execute(input: UpdateSubjectConfigurationInput): Promise<Subject> {
    const validation = new UpdateSubjectConfigurationValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return await this.subjectRepository.update(input.subjectId, (subject) => ({
      ...subject,
      plannedStudyMinutes: input.plannedStudyMinutes ?? subject.plannedStudyMinutes,
      currentStage: input.currentStage ?? subject.currentStage
    }));
  }
}