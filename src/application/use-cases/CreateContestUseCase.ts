import { Contest } from "@/domain/entities/Contest";
import { CycleState } from "@/domain/entities/CycleState";
import { AlreadyExistsError } from "@/domain/errors/DomainErrors";
import { ValidationError } from "@/domain/errors/DomainErrors";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import { CreateContestValidator } from "@/application/validation/InputValidators";

export interface CreateContestInput {
  id: string;
  name: string;
}

export class CreateContestUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly repositoryFactory: RepositoryFactory
  ) {}

  async execute(input: CreateContestInput): Promise<Contest> {
    const validation = new CreateContestValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((draft) => {
      if (draft.contests.some((contest) => contest.id === input.id)) {
        throw new AlreadyExistsError("contests", input.id);
      }

      const contest = new Contest(input.id, input.name);
      draft.contests.push(contest);
      draft.cycleStates.push(new CycleState(contest.id));
      if (draft.activeContestId === null) {
        draft.activeContestId = contest.id;
      }
      return contest;
    });
  }
}
