import { ValidationError } from "@/domain/errors/DomainErrors";

/**
 * Represents the current state of a contest cycle.
 */
export class ContestState {
  constructor(
    public readonly contestId: string,
    public readonly currentSubjectId: string | null = null,
    public readonly currentItemId: string | null = null
  ) {
    if (!contestId?.trim()) throw new ValidationError("ContestState contestId is required");
  }
}
