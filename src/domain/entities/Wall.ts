import { ValidationError } from "@/domain/errors/DomainErrors";

/**
 * Represents a link on the contest wall.
 */
export class WallLink {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly url: string
  ) {
    if (!id?.trim()) throw new ValidationError("WallLink ID is required");
    if (!label?.trim()) throw new ValidationError("WallLink label is required");
    if (!url?.trim()) throw new ValidationError("WallLink URL is required");
  }
}

/**
 * Represents a subject snapshot on the contest wall.
 */
export class WallSubjectSnapshot {
  constructor(
    public readonly subjectId: string,
    public readonly weight?: number,
    public readonly score?: number,
    public readonly targetItems?: string[]
  ) {
    if (!subjectId?.trim()) throw new ValidationError("WallSubjectSnapshot subjectId is required");
    if (weight !== undefined && weight < 0) throw new ValidationError("Weight cannot be negative");
    if (score !== undefined && score < 0) throw new ValidationError("Score cannot be negative");
  }
}

/**
 * Represents the contest wall with notices, exams, and subject snapshots.
 */
export class Wall {
  constructor(
    public readonly noticeLinks: WallLink[] = [],
    public readonly examLinks: WallLink[] = [],
    public readonly subjectSnapshots: WallSubjectSnapshot[] = [],
    public readonly notes?: string
  ) {}
}

/**
 * The kinds of single-link slots the wall form manages.
 */
export type WallLinkKind = "notice" | "exam";

/**
 * Builds the stable identifier used for the wall's single notice/exam link.
 * The wall form overwrites the link on every save, so a deterministic id
 * keeps the array at length 0 or 1 instead of appending duplicates.
 */
export function wallLinkKey(contestId: string, kind: WallLinkKind): string {
  return `${contestId}-${kind}`;
}
