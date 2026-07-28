import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CycleState, type CyclePosition } from "@/domain/entities/CycleState";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import { CycleService } from "@/domain/services/CycleService";

export interface AdvanceCycleResult {
  previous: CyclePosition;
  current: CyclePosition;
}

export class AdvanceCycleUseCase {
  private readonly cycleService = new CycleService();

  constructor(private readonly dataStore: PluginDataStore) {}

  async execute(): Promise<AdvanceCycleResult> {
    return this.dataStore.mutate((draft) => {
      const activeContestId = draft.activeContestId;
      if (!activeContestId) {
        throw new ValidationError("There is no active contest.");
      }
      if (!draft.contests.some((contest) => contest.id === activeContestId)) {
        throw new NotFoundError("contests", activeContestId);
      }

      const subjects = draft.subjects.filter((subject) => subject.contestId === activeContestId);
      const subjectIds = new Set(subjects.map((subject) => subject.id));
      const resources = draft.resources.filter((resource) => subjectIds.has(resource.subjectId));
      const records = draft.studyRecords.filter(
        (record) => record.contestId === activeContestId
      );
      let stateIndex = draft.cycleStates.findIndex((state) => state.contestId === activeContestId);
      if (stateIndex === -1) {
        draft.cycleStates.push(new CycleState(activeContestId));
        stateIndex = draft.cycleStates.length - 1;
      }

      const state = draft.cycleStates[stateIndex];
      const previous = this.cycleService.getRecommendation(subjects, resources, records, state);
      const current = this.cycleService.advance(subjects, resources, records, {
        ...state,
        currentSubjectId: previous.subjectId,
        currentResourceId: previous.resourceId
      });
      if (!current) {
        throw new ValidationError(`Contest "${activeContestId}" has no active subjects.`);
      }
      draft.cycleStates[stateIndex] = new CycleState(
        activeContestId,
        current.subjectId,
        current.resourceId
      );

      return { previous, current };
    });
  }
}
