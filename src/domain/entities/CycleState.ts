import { ValidationError } from "@/domain/errors/DomainErrors";

/**
 * Estado do ciclo: the learner's current Matéria and Recurso position in a
 * Concurso study cycle.
 */
export class CycleState {
  constructor(
    public readonly contestId: string,
    public readonly currentSubjectId: string | null = null,
    public readonly currentResourceId: string | null = null
  ) {
    if (!contestId?.trim()) throw new ValidationError("CycleState contestId is required");
  }
}

/**
 * A concrete cycle position, used to report and restore advancement.
 */
export interface CyclePosition {
  subjectId: string | null;
  resourceId: string | null;
}
