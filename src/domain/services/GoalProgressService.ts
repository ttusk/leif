import type { Resource } from "@/domain/entities/Resource";
import type { StudyRecord } from "@/domain/entities/StudyRecord";
import type { StudySession } from "@/domain/entities/StudySession";

/**
 * Computes aggregate progress for Recursos. Only records whose unit matches
 * the resource goal unit are aggregated, plus any imported progress baseline.
 * A resource completes when accumulated records reach its goal, or when it is
 * explicitly completed; a goal-less resource stays incomplete until then.
 */
export class GoalProgressService {
  /**
   * Accumulated compatible progress for a resource, including its baseline.
   */
  progressFor(resource: Resource, sessions: StudySession[]): number {
    return this.progressFromRecords(
      resource,
      sessions.flatMap((session) => session.records)
    );
  }

  /**
   * Record-list variant of {@link progressFor}.
   */
  progressFromRecords(resource: Resource, records: StudyRecord[]): number {
    if (!resource.goal) {
      return resource.baseline?.quantity ?? 0;
    }
    const unit = resource.goal.unit;
    const recorded = records
      .filter((record) => record.resourceId === resource.id && record.unit === unit)
      .reduce((total, record) => total + (record.quantity ?? 0), 0);
    return recorded + (resource.baseline?.quantity ?? 0);
  }

  /**
   * Correct answers accumulated for a resource, including its baseline.
   */
  correctAnswersFor(resource: Resource, sessions: StudySession[]): number {
    const recorded = sessions
      .flatMap((session) => session.records)
      .filter((record) => record.resourceId === resource.id)
      .reduce((total, record) => total + (record.correctAnswers ?? 0), 0);
    return recorded + (resource.baseline?.correctAnswers ?? 0);
  }

  /**
   * True when the resource is explicitly completed or its accumulated
   * compatible progress meets the goal. A goal-less resource is incomplete
   * until explicitly completed.
   */
  isComplete(resource: Resource, sessions: StudySession[]): boolean {
    return this.isCompleteFromRecords(
      resource,
      sessions.flatMap((session) => session.records)
    );
  }

  /**
   * Record-list variant of {@link isComplete}.
   */
  isCompleteFromRecords(resource: Resource, records: StudyRecord[]): boolean {
    if (resource.completed) {
      return true;
    }
    if (!resource.goal) {
      return false;
    }
    return this.progressFromRecords(resource, records) >= resource.goal.amount;
  }

  /**
   * Builds a predicate that returns true when a given resource id is complete
   * for the supplied set of resources and sessions.
   */
  buildCompletionPredicate(
    resources: Resource[],
    sessions: StudySession[]
  ): (resourceId: string) => boolean {
    const byId = new Map(resources.map((resource) => [resource.id, resource]));
    return (resourceId: string) => {
      const resource = byId.get(resourceId);
      if (!resource) return false;
      return this.isComplete(resource, sessions);
    };
  }
}
