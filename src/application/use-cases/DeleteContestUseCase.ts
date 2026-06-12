import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { Contest } from "@/domain/entities/Contest";
import { EntityRepository } from "@/infrastructure/persistence/EntityRepository";

export interface DeleteContestInput {
  contestId: string;
}

/**
 * Use case for deleting a contest.
 */
export class DeleteContestUseCase {
  private readonly contestRepository: EntityRepository<Contest>;

  constructor(private readonly dataStore: PluginDataStore) {
    this.contestRepository = new EntityRepository<Contest>(dataStore, "contests");
  }

  async execute(input: DeleteContestInput): Promise<Contest> {
    const contest = await this.contestRepository.findById(input.contestId);
    await this.contestRepository.delete(input.contestId);
    return contest;
  }
}
