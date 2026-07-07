import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { Subject } from "@/domain/entities/Subject";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { SetSubjectActiveStateValidator } from "@/application/validation/InputValidators";

export interface SetSubjectActiveStateInput {
  subjectId: string;
  isActive: boolean;
}

/**
 * Use case for setting a subject's active state.
 */
export class SetSubjectActiveStateUseCase {
  private readonly subjectRepository: EntityRepositoryPort<Subject>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.subjectRepository = repositoryFactory.for("subjects");
  }

  async execute(input: SetSubjectActiveStateInput): Promise<Subject> {
    const validation = new SetSubjectActiveStateValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return await this.subjectRepository.update(input.subjectId, (subject) => ({
      ...subject,
      isActive: input.isActive
    }));
  }
}