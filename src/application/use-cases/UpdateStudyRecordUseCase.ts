import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import {
  buildStudyRecord,
  type RegisterStudyRecordInput
} from "@/application/use-cases/RegisterStudyRecordsUseCase";
import type { StudyRecord } from "@/domain/entities/StudyRecord";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

export interface UpdateStudyRecordInput {
  recordId: string;
  date?: string;
  subjectId?: string;
  resourceId?: string | null;
  topicId?: string | null;
  quantity?: number | null;
  unit?: RegisterStudyRecordInput["unit"] | null;
  correctAnswers?: number | null;
  completed?: boolean;
  notes?: string | null;
}

export class UpdateStudyRecordUseCase {
  constructor(private readonly dataStore: PluginDataStore) {}

  async execute(input: UpdateStudyRecordInput): Promise<StudyRecord> {
    if (!input.recordId?.trim()) {
      throw new ValidationError("recordId is required");
    }

    return this.dataStore.mutate((draft) => {
      const index = draft.studyRecords.findIndex((record) => record.id === input.recordId);
      if (index === -1) {
        throw new NotFoundError("studyRecords", input.recordId);
      }
      const current = draft.studyRecords[index];
      const updated = buildStudyRecord(draft, current.contestId, input.date ?? current.date, {
        id: current.id,
        subjectId: input.subjectId ?? current.subjectId,
        resourceId:
          input.resourceId === null ? undefined : (input.resourceId ?? current.resourceId),
        topicId: input.topicId === null ? undefined : (input.topicId ?? current.topicId),
        quantity: input.quantity === null ? undefined : (input.quantity ?? current.quantity),
        unit: input.unit === null ? undefined : (input.unit ?? current.unit),
        correctAnswers:
          input.correctAnswers === null
            ? undefined
            : (input.correctAnswers ?? current.correctAnswers),
        completed: input.completed ?? current.completed,
        notes: input.notes === null ? undefined : (input.notes ?? current.notes)
      });
      draft.studyRecords[index] = updated;
      return updated;
    });
  }
}
