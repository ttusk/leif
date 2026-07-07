import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { Contest } from "@/domain/entities/Contest";

export interface DeleteContestInput {
  contestId: string;
}

/**
 * Use case for deleting a contest.
 */
export class DeleteContestUseCase {
  private readonly contestRepository: EntityRepositoryPort<Contest>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.contestRepository = repositoryFactory.for("contests");
  }

  async execute(input: DeleteContestInput): Promise<Contest> {
    const contest = await this.contestRepository.findById(input.contestId);

    const data = await this.dataStore.load();
    const subjectIds = new Set(contest.subjectIds);

    data.contests = data.contests.filter((c) => c.id !== input.contestId);
    data.contestStates = data.contestStates.filter((s) => s.contestId !== input.contestId);
    data.subjects = data.subjects.filter((s) => s.contestId !== input.contestId);
    data.studyItems = data.studyItems.filter((i) => !subjectIds.has(i.subjectId));
    data.topics = data.topics.filter((t) => !subjectIds.has(t.subjectId));
    data.studySessions = data.studySessions.filter((s) => s.contestId !== input.contestId);

    if (data.activeContestId === input.contestId) {
      data.activeContestId = null;
    }

    await this.dataStore.save(data);
    return contest;
  }
}
