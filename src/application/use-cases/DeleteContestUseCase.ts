import { Contest } from "@/domain/entities/Contest";
import { NotFoundError } from "@/domain/errors/DomainErrors";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";

export interface DeleteContestInput {
  contestId: string;
}

export class DeleteContestUseCase {
  constructor(private readonly dataStore: PluginDataStore) {}

  async execute(input: DeleteContestInput): Promise<Contest> {
    return this.dataStore.mutate((draft) => {
      const contest = draft.contests.find((entry) => entry.id === input.contestId);
      if (!contest) {
        throw new NotFoundError("contests", input.contestId);
      }

      const subjectIds = new Set(
        draft.subjects
          .filter((subject) => subject.contestId === input.contestId)
          .map((subject) => subject.id)
      );

      draft.contests = draft.contests.filter((entry) => entry.id !== input.contestId);
      draft.cycleStates = draft.cycleStates.filter((entry) => entry.contestId !== input.contestId);
      draft.subjects = draft.subjects.filter((subject) => !subjectIds.has(subject.id));
      draft.resources = draft.resources.filter((resource) => !subjectIds.has(resource.subjectId));
      draft.topics = draft.topics.filter((topic) => !subjectIds.has(topic.subjectId));
      draft.studySessions = draft.studySessions.filter(
        (session) => session.contestId !== input.contestId
      );

      if (draft.activeContestId === input.contestId) {
        draft.activeContestId = null;
      }

      return contest;
    });
  }
}
