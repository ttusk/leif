import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CycleState } from "@/domain/entities/CycleState";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import { CycleService } from "@/domain/services/CycleService";

export interface SelectCycleSubjectInput {
  subjectId: string;
}

export class SelectCycleSubjectUseCase {
  private readonly cycleService = new CycleService();

  constructor(private readonly dataStore: PluginDataStore) {}

  async execute(input: SelectCycleSubjectInput): Promise<CycleState> {
    if (!input.subjectId?.trim()) {
      throw new ValidationError("subjectId is required");
    }

    return this.dataStore.mutate((draft) => {
      const contestId = draft.activeContestId;
      if (!contestId) {
        throw new ValidationError("There is no active contest.");
      }
      const subject = draft.subjects.find((entry) => entry.id === input.subjectId);
      if (!subject) {
        throw new NotFoundError("subjects", input.subjectId);
      }
      if (subject.contestId !== contestId || !subject.isActive) {
        throw new ValidationError("The selected subject must be active in the current contest.");
      }

      const subjectIds = new Set(
        draft.subjects
          .filter((entry) => entry.contestId === contestId)
          .map((entry) => entry.id)
      );
      const resources = draft.resources.filter((resource) => subjectIds.has(resource.subjectId));
      const records = draft.studyRecords.filter((record) => record.contestId === contestId);
      const selected = new CycleState(
        contestId,
        subject.id,
        this.cycleService.firstIncompleteResourceId(subject, resources, records)
      );
      const index = draft.cycleStates.findIndex((state) => state.contestId === contestId);
      if (index === -1) draft.cycleStates.push(selected);
      else draft.cycleStates[index] = selected;
      return selected;
    });
  }
}
