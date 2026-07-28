import { Subject } from "@/domain/entities/Subject";
import { ValidationError } from "@/domain/errors/DomainErrors";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import { UpdateSubjectConfigurationValidator } from "@/application/validation/InputValidators";

export interface UpdateSubjectConfigurationInput {
  subjectId: string;
  plannedStudyMinutes?: number;
  currentStage?: string;
}

export class UpdateSubjectConfigurationUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly repositoryFactory: RepositoryFactory
  ) {}

  async execute(input: UpdateSubjectConfigurationInput): Promise<Subject> {
    const validation = new UpdateSubjectConfigurationValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    const subjectRepository = this.repositoryFactory.for("subjects");

    return subjectRepository.update(input.subjectId, (subject) => {
      return new Subject(
        subject.id,
        subject.contestId,
        subject.name,
        subject.order,
        subject.isActive,
        input.plannedStudyMinutes ?? subject.plannedStudyMinutes,
        input.currentStage ?? subject.currentStage,
        [...subject.resourceIds],
        [...subject.topicIds]
      );
    });
  }
}
