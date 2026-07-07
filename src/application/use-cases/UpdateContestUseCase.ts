import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { Contest } from "@/domain/entities/Contest";

export interface UpdateContestInput {
  contestId: string;
  name?: string;
  notes?: string;
}

/**
 * Use case for updating a contest.
 */
export class UpdateContestUseCase {
  private readonly contestRepository: EntityRepositoryPort<Contest>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.contestRepository = repositoryFactory.for("contests");
  }

  async execute(input: UpdateContestInput): Promise<Contest> {
    return await this.contestRepository.update(input.contestId, (contest) => ({
      ...contest,
      name: input.name ?? contest.name,
      wall: {
        ...contest.wall,
        notes: input.notes ?? contest.wall.notes
      }
    }));
  }
}
