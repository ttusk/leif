import { ValidationError } from "@/domain/errors/DomainErrors";
import { Wall } from "@/domain/entities/Wall";

/**
 * Represents a public exam contest.
 */
export class Contest {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly subjectIds: string[] = [],
    public readonly wall: Wall = new Wall()
  ) {
    if (!id?.trim()) throw new ValidationError("Contest ID is required");
    if (!name?.trim()) throw new ValidationError("Contest name is required");
  }
}