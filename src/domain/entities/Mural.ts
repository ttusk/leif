import { ValidationError } from "@/domain/errors/DomainErrors";

/**
 * A structured planning snapshot for one Matéria shown on the Mural.
 */
export class MuralSubjectSnapshot {
  constructor(
    public readonly subjectId: string,
    public readonly weight?: number,
    public readonly score?: number,
    public readonly targetResources: string[] = []
  ) {
    if (!subjectId?.trim()) {
      throw new ValidationError("MuralSubjectSnapshot subjectId is required");
    }
    if (weight !== undefined && weight < 0) {
      throw new ValidationError("MuralSubjectSnapshot weight cannot be negative");
    }
    if (score !== undefined && score < 0) {
      throw new ValidationError("MuralSubjectSnapshot score cannot be negative");
    }
  }
}

/**
 * Mural: the free-form reference area of a Concurso. Notes are readable
 * Markdown; snapshots are the only structured content.
 */
export class Mural {
  constructor(
    public readonly notes?: string,
    public readonly snapshots: MuralSubjectSnapshot[] = []
  ) {}
}
