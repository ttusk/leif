import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { Contest } from "@/domain/entities/Contest";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { SetActiveContestValidator } from "@/application/validation/InputValidators";

export interface SetActiveContestInput {
  contestId: string;
}

/**
 * Use case for setting the active contest.
 */
export class SetActiveContestUseCase {
  private readonly contestRepository: EntityRepositoryPort<Contest>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.contestRepository = repositoryFactory.for("contests");
  }

  async execute(input: SetActiveContestInput): Promise<void> {
    const validation = new SetActiveContestValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    await this.contestRepository.findById(input.contestId);

    const data = await this.dataStore.load();
    await this.dataStore.save({
      ...data,
      activeContestId: input.contestId
    });
  }
}
