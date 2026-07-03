import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { ContestState } from "@/domain/entities/ContestState";
import { ActiveCycleSnapshot } from "@/application/use-cases/GetActiveCycleSnapshotUseCase";
import { CycleService } from "@/domain/services/CycleService";
import { ItemProgressService } from "@/domain/services/ItemProgressService";
import { ActiveContestGuard } from "@/application/guards/ActiveContestGuard";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

/**
 * Use case for advancing the study cycle to the next subject.
 */
export class AdvanceCycleUseCase {
  private readonly guard: ActiveContestGuard;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly cycleService: CycleService = new CycleService(),
    private readonly progressService: ItemProgressService = new ItemProgressService()
  ) {
    this.guard = new ActiveContestGuard(dataStore);
  }

  async execute(): Promise<ActiveCycleSnapshot & { currentSubjectId: string | null; currentItemId: string | null }> {
    const activeContestId = await this.guard.requireActiveContest();

    const contestSubjects = await this.guard.getActiveContestSubjects();

    const data = await this.dataStore.load();
    const currentState = data.contestStates.find((state) => state.contestId === activeContestId);

    if (!currentState) {
      throw new NotFoundError("contestStates", activeContestId);
    }

    const nextSubject = this.cycleService.getNextActiveSubject(
      contestSubjects,
      currentState.currentSubjectId ?? undefined
    );

    if (!nextSubject) {
      throw new ValidationError(`Contest "${activeContestId}" has no active subjects.`);
    }

    const subjectItems = data.studyItems.filter(
      (item) => item.subjectId === nextSubject.id
    );
    const isCompleted = this.progressService.buildCompletionPredicate(
      subjectItems,
      data.studySessions
    );

    const nextState: ContestState = {
      contestId: currentState.contestId,
      currentSubjectId: nextSubject.id,
      currentItemId: this.cycleService.getNextItemId(nextSubject, undefined, isCompleted)
    };

    await this.dataStore.save({
      ...data,
      contestStates: data.contestStates.map((state) =>
        state.contestId === nextState.contestId ? nextState : state
      )
    });

    const subjectAfter = this.cycleService.getNextActiveSubject(
      contestSubjects,
      nextSubject.id
    );
    const subjectAfterItems = data.studyItems.filter(
      (item) => item.subjectId === subjectAfter?.id
    );
    const isSubjectAfterCompleted = this.progressService.buildCompletionPredicate(
      subjectAfterItems,
      data.studySessions
    );

    return {
      contestId: activeContestId,
      currentSubject: nextSubject,
      nextSubject: subjectAfter,
      currentItemId: nextState.currentItemId,
      nextItemId: subjectAfter
        ? this.cycleService.getNextItemId(subjectAfter, undefined, isSubjectAfterCompleted)
        : null,
      currentSubjectId: nextState.currentSubjectId
    };
  }
}
