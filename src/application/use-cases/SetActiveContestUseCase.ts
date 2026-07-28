import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import { SetActiveContestValidator } from "@/application/validation/InputValidators";

export interface SetActiveContestInput {
  contestId: string;
}

export class SetActiveContestUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly repositoryFactory: RepositoryFactory
  ) {}

  async execute(input: SetActiveContestInput): Promise<void> {
    const validation = new SetActiveContestValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    await this.dataStore.mutate((draft) => {
      if (!draft.contests.some((contest) => contest.id === input.contestId)) {
        throw new NotFoundError("contests", input.contestId);
      }
      draft.activeContestId = input.contestId;
    });
  }
}
