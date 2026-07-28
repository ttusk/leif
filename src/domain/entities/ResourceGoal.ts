import { ValidationError } from "@/domain/errors/DomainErrors";
import type { GoalUnit } from "@/domain/types/GoalUnit";

/**
 * Meta do recurso: an optional measurable completion target for a Resource.
 */
export class ResourceGoal {
  constructor(
    public readonly amount: number,
    public readonly unit: GoalUnit
  ) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError("ResourceGoal amount must be positive");
    }
    if (!unit?.trim()) throw new ValidationError("ResourceGoal unit is required");
  }
}
