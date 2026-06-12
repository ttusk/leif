import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { Contest } from "@/domain/entities/Contest";
import { EntityRepository } from "@/infrastructure/persistence/EntityRepository";

export interface UpdateContestInput {
  contestId: string;
  name?: string;
  notes?: string;
}

/**
 * Use case for updating a contest.
 */
export class UpdateContestUseCase {
  private readonly contestRepository: EntityRepository<Contest>;

  constructor(private readonly dataStore: PluginDataStore) {
    this.contestRepository = new EntityRepository<Contest>(dataStore, "contests");
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
