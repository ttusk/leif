import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CycleState, type CyclePosition } from "@/domain/entities/CycleState";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

export interface RestoreCyclePositionInput {
  contestId: string;
  expectedCurrent: CyclePosition;
  restoreTo: CyclePosition;
}

export class RestoreCyclePositionUseCase {
  constructor(private readonly dataStore: PluginDataStore) {}

  async execute(input: RestoreCyclePositionInput): Promise<CycleState> {
    return this.dataStore.mutate((draft) => {
      const index = draft.cycleStates.findIndex((state) => state.contestId === input.contestId);
      if (index === -1) {
        throw new NotFoundError("cycleStates", input.contestId);
      }
      const current = draft.cycleStates[index];
      if (
        current.currentSubjectId !== input.expectedCurrent.subjectId ||
        current.currentResourceId !== input.expectedCurrent.resourceId
      ) {
        throw new ValidationError("O ciclo mudou depois deste registro e não pode ser desfeito.");
      }

      const restored = new CycleState(
        input.contestId,
        input.restoreTo.subjectId,
        input.restoreTo.resourceId
      );
      draft.cycleStates[index] = restored;
      return restored;
    });
  }
}
