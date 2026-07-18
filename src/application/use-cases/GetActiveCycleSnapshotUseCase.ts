import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { Subject } from "@/domain/entities/Subject";
import { CycleService } from "@/domain/services/CycleService";
import { ItemProgressService } from "@/domain/services/ItemProgressService";
import { ActiveContestGuard } from "@/application/guards/ActiveContestGuard";
import { NotFoundError } from "@/domain/errors/DomainErrors";

export interface ActiveCycleSnapshot {
  contestId: string;
  currentSubject: Subject | null;
  nextSubject: Subject | null;
  currentItemId: string | null;
  nextItemId: string | null;
}

/**
 * Use case for getting the active cycle snapshot.
 */
export class GetActiveCycleSnapshotUseCase {
  private readonly guard: ActiveContestGuard;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly cycleService: CycleService = new CycleService(),
    private readonly progressService: ItemProgressService = new ItemProgressService()
  ) {
    this.guard = new ActiveContestGuard(dataStore);
  }

  async execute(): Promise<ActiveCycleSnapshot> {
    const activeContestId = await this.guard.requireActiveContest();
    const data = await this.dataStore.load();

    const currentState = data.contestStates.find((state) => state.contestId === activeContestId);

    if (!currentState) {
      throw new NotFoundError("contestStates", activeContestId);
    }

    const contestSubjects = await this.guard.getActiveContestSubjects();

    const currentSubject =
      contestSubjects.find((subject) => subject.id === currentState.currentSubjectId) ?? null;
    const nextSubject = this.cycleService.getNextActiveSubject(
      contestSubjects,
      currentState.currentSubjectId ?? undefined
    );

    const subjectForNextItem = currentSubject ?? nextSubject;
    const subjectItems = data.studyItems.filter(
      (item) => item.subjectId === subjectForNextItem?.id
    );
    const isCompleted = this.progressService.buildCompletionPredicate(
      subjectItems,
      data.studySessions
    );

    return {
      contestId: activeContestId,
      currentSubject,
      nextSubject,
      currentItemId: currentState.currentItemId,
      nextItemId: subjectForNextItem
        ? this.cycleService.getNextItemId(
            subjectForNextItem,
            currentSubject ? (currentState.currentItemId ?? undefined) : undefined,
            isCompleted
          )
        : null
    };
  }
}
