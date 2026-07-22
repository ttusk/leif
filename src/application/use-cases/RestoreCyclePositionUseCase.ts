import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { CyclePosition } from "@/application/use-cases/RegisterRecommendedStudySessionUseCase";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

export interface RestoreCyclePositionInput {
  contestId: string;
  expectedPosition: CyclePosition;
  restorePosition: CyclePosition;
}

/** Restores a cycle pointer only when no newer advancement has replaced it. */
export class RestoreCyclePositionUseCase {
  constructor(private readonly dataStore: PluginDataStore) {}

  async execute(input: RestoreCyclePositionInput): Promise<CyclePosition> {
    return this.dataStore.mutate((data) => {
      const index = data.contestStates.findIndex((state) => state.contestId === input.contestId);
      if (index < 0) {
        throw new NotFoundError("contestStates", input.contestId);
      }

      const current = data.contestStates[index];
      if (
        (current.currentSubjectId ?? null) !== input.expectedPosition.subjectId ||
        (current.currentItemId ?? null) !== input.expectedPosition.itemId
      ) {
        throw new ValidationError("O ciclo mudou depois deste registro e não pode ser desfeito.");
      }

      data.contestStates[index] = {
        ...current,
        currentSubjectId: input.restorePosition.subjectId,
        currentItemId: input.restorePosition.itemId
      };
      return input.restorePosition;
    });
  }
}
