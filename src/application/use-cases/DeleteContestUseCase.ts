import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { Contest } from "@/domain/entities/Contest";
import { NotFoundError } from "@/domain/errors/DomainErrors";

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
    return this.dataStore.mutate((data) => {
      const contest = data.contests.find((candidate) => candidate.id === input.contestId);
      if (!contest) throw new NotFoundError("contests", input.contestId);
      const subjectIds = new Set(
        data.subjects
          .filter((subject) => subject.contestId === input.contestId)
          .map((subject) => subject.id)
      );

      data.contests = data.contests.filter((candidate) => candidate.id !== input.contestId);
      data.contestStates = data.contestStates.filter(
        (state) => state.contestId !== input.contestId
      );
      data.subjects = data.subjects.filter((subject) => subject.contestId !== input.contestId);
      data.studyItems = data.studyItems.filter((item) => !subjectIds.has(item.subjectId));
      data.topics = data.topics.filter((topic) => !subjectIds.has(topic.subjectId));
      data.studySessions = data.studySessions.filter(
        (session) => session.contestId !== input.contestId
      );

      if (data.activeContestId === input.contestId) data.activeContestId = null;
      return contest;
    });
  }
}
