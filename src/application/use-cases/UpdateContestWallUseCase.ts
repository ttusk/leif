import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { Contest } from "@/domain/entities/Contest";
import type { Wall } from "@/domain/entities/Wall";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { UpdateContestWallValidator } from "@/application/validation/InputValidators";

export interface UpdateContestWallInput {
  contestId: string;
  wall: Wall;
}

/**
 * Use case for updating a contest's wall.
 */
export class UpdateContestWallUseCase {
  private readonly contestRepository: EntityRepositoryPort<Contest>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.contestRepository = repositoryFactory.for("contests");
  }

  async execute(input: UpdateContestWallInput): Promise<Contest> {
    const validation = new UpdateContestWallValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return await this.contestRepository.update(input.contestId, (contest) => ({
      ...contest,
      wall: input.wall
    }));
  }
}
