import type { CyclePosition, CycleState } from "@/domain/entities/CycleState";
import type { Resource } from "@/domain/entities/Resource";
import type { StudyRecord } from "@/domain/entities/StudyRecord";
import type { Subject } from "@/domain/entities/Subject";
import { GoalProgressService } from "@/domain/services/GoalProgressService";

/**
 * Service for study-cycle navigation. The cycle rotates active Matérias; on
 * each visit it recommends the first incomplete ordered Recurso of the current
 * Matéria. Assuntos do not add another cycle level.
 */
export class CycleService {
  constructor(private readonly progress: GoalProgressService = new GoalProgressService()) {}

  private getNextInCycle<T>(
    items: T[],
    currentItem: T | undefined,
    idGetter: (item: T) => string
  ): T | null {
    if (items.length === 0) {
      return null;
    }

    if (!currentItem) {
      return items[0];
    }

    const currentIndex = items.findIndex((item) => idGetter(item) === idGetter(currentItem));

    if (currentIndex === -1) {
      return items[0];
    }

    return items[(currentIndex + 1) % items.length];
  }

  private activeSubjectsInOrder(subjects: Subject[]): Subject[] {
    return subjects
      .filter((subject) => subject.isActive)
      .sort((left, right) => left.order - right.order);
  }

  /**
   * Gets the next active subject in the study cycle, wrapping around.
   */
  getNextActiveSubject(subjects: Subject[], currentSubjectId?: string): Subject | null {
    const activeSubjects = this.activeSubjectsInOrder(subjects);
    const currentSubject = currentSubjectId
      ? activeSubjects.find((subject) => subject.id === currentSubjectId)
      : undefined;

    return this.getNextInCycle(activeSubjects, currentSubject, (subject) => subject.id);
  }

  private firstIncompleteFromRecords(
    subject: Subject,
    resources: Resource[],
    records: StudyRecord[]
  ): string | null {
    const byId = new Map(resources.map((resource) => [resource.id, resource]));
    for (const resourceId of subject.resourceIds) {
      const resource = byId.get(resourceId);
      if (resource && !this.progress.isCompleteFromRecords(resource, records)) {
        return resourceId;
      }
    }
    return null;
  }

  /**
   * The first incomplete ordered resource of a subject, or null when there is
   * none. Resources without a goal are incomplete until explicitly completed.
   */
  firstIncompleteResourceId(
    subject: Subject,
    resources: Resource[],
    records: StudyRecord[]
  ): string | null {
    return this.firstIncompleteFromRecords(subject, resources, records);
  }

  private recommendationFromRecords(
    subjects: Subject[],
    resources: Resource[],
    records: StudyRecord[],
    state: CycleState | undefined
  ): CyclePosition {
    const activeSubjects = this.activeSubjectsInOrder(subjects);
    const stored = state?.currentSubjectId
      ? activeSubjects.find((subject) => subject.id === state.currentSubjectId)
      : undefined;
    const subject = stored ?? activeSubjects[0] ?? null;

    if (!subject) {
      return { subjectId: null, resourceId: null };
    }

    return {
      subjectId: subject.id,
      resourceId: this.firstIncompleteFromRecords(subject, resources, records)
    };
  }

  /**
   * The position the cycle recommends studying now: the stored current
   * subject when still active (otherwise the first active one) and its first
   * incomplete ordered resource.
   */
  getRecommendation(
    subjects: Subject[],
    resources: Resource[],
    records: StudyRecord[],
    state: CycleState | undefined
  ): CyclePosition {
    return this.recommendationFromRecords(subjects, resources, records, state);
  }

  private advanceFromRecords(
    subjects: Subject[],
    resources: Resource[],
    records: StudyRecord[],
    currentSubjectId: string | null | undefined
  ): CyclePosition | null {
    const nextSubject = this.getNextActiveSubject(subjects, currentSubjectId ?? undefined);
    if (!nextSubject) {
      return null;
    }
    return {
      subjectId: nextSubject.id,
      resourceId: this.firstIncompleteFromRecords(nextSubject, resources, records)
    };
  }

  /**
   * Rotates to the next active subject and points at its first incomplete
   * resource. Returns null when no subject is active.
   */
  advance(
    subjects: Subject[],
    resources: Resource[],
    records: StudyRecord[],
    state: CycleState | undefined
  ): CyclePosition | null {
    return this.advanceFromRecords(subjects, resources, records, state?.currentSubjectId);
  }
}
