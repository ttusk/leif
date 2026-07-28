import { ValidationError } from "@/domain/errors/DomainErrors";
import type { StudyRecord } from "@/domain/entities/StudyRecord";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Sessão de estudo: one study sitting that groups one or more ordered
 * Registros de estudo. A session is the atomic unit of history: saving it
 * persists all records and any cycle changes together, and empty sessions
 * never persist.
 */
export class StudySession {
  constructor(
    public readonly id: string,
    public readonly contestId: string,
    public readonly date: string,
    public readonly records: StudyRecord[],
    public readonly startTime?: string,
    public readonly endTime?: string,
    public readonly notes?: string
  ) {
    if (!id?.trim()) throw new ValidationError("StudySession ID is required");
    if (!contestId?.trim()) throw new ValidationError("StudySession contestId is required");
    if (!date?.trim() || !DATE_PATTERN.test(date)) {
      throw new ValidationError("StudySession date must use YYYY-MM-DD");
    }
    if (startTime !== undefined && !TIME_PATTERN.test(startTime)) {
      throw new ValidationError("StudySession startTime must use HH:MM");
    }
    if (endTime !== undefined && !TIME_PATTERN.test(endTime)) {
      throw new ValidationError("StudySession endTime must use HH:MM");
    }
    if (!Array.isArray(records) || records.length === 0) {
      throw new ValidationError("StudySession requires at least one record");
    }
  }
}
