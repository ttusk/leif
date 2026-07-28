import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { createLeifId } from "@/application/Id";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { StudySession } from "@/domain/entities/StudySession";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import type { RegisterStudyRecordInput } from "@/application/use-cases/RegisterStudySessionUseCase";

export interface UpdateStudySessionInput {
  sessionId: string;
  date?: string;
  records?: RegisterStudyRecordInput[];
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
}

export class UpdateStudySessionUseCase {
  constructor(private readonly dataStore: PluginDataStore) {}

  async execute(input: UpdateStudySessionInput): Promise<StudySession> {
    if (!input.sessionId?.trim()) {
      throw new ValidationError("sessionId is required");
    }
    if (input.records !== undefined && input.records.length === 0) {
      throw new ValidationError("StudySession requires at least one record");
    }

    return this.dataStore.mutate((draft) => {
      const index = draft.studySessions.findIndex((session) => session.id === input.sessionId);
      if (index === -1) {
        throw new NotFoundError("studySessions", input.sessionId);
      }
      const current = draft.studySessions[index];
      const records =
        input.records?.map(
          (record) =>
            new StudyRecord(
              record.id ?? createLeifId(),
              record.subjectId,
              record.resourceId,
              record.topicId,
              record.quantity,
              record.unit,
              record.correctAnswers,
              record.completed ?? false,
              record.notes
            )
        ) ?? current.records;
      const updated = new StudySession(
        current.id,
        current.contestId,
        input.date ?? current.date,
        records,
        input.startTime === null ? undefined : (input.startTime ?? current.startTime),
        input.endTime === null ? undefined : (input.endTime ?? current.endTime),
        input.notes === null ? undefined : (input.notes ?? current.notes)
      );
      draft.studySessions[index] = updated;
      return updated;
    });
  }
}
