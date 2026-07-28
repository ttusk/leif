import { createLeifId } from "@/application/Id";
import type { MutableLeifPluginData, PluginDataStore } from "@/application/ports/PluginDataStore";
import { RegisterStudyRecordsValidator } from "@/application/validation/InputValidators";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { AlreadyExistsError, NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import type { GoalUnit } from "@/domain/types/GoalUnit";

export interface RegisterStudyRecordInput {
  id?: string;
  subjectId: string;
  resourceId?: string;
  topicId?: string;
  quantity?: number;
  unit?: GoalUnit;
  correctAnswers?: number;
  completed?: boolean;
  notes?: string;
}

export interface RegisterStudyRecordsInput {
  contestId: string;
  date: string;
  records: RegisterStudyRecordInput[];
}

export interface RegisterStudyRecordsResult {
  records: StudyRecord[];
}

export class RegisterStudyRecordsUseCase {
  constructor(private readonly dataStore: PluginDataStore) {}

  async execute(input: RegisterStudyRecordsInput): Promise<RegisterStudyRecordsResult> {
    const validation = new RegisterStudyRecordsValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((draft) => {
      if (!draft.contests.some((contest) => contest.id === input.contestId)) {
        throw new NotFoundError("contests", input.contestId);
      }

      const ids = input.records.map((record) => record.id ?? createLeifId());
      const repeatedIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      const existingIds = new Set(draft.studyRecords.map((record) => record.id));
      const duplicateId = ids.find((id) => existingIds.has(id)) ?? repeatedIds[0];
      if (duplicateId) {
        throw new AlreadyExistsError("studyRecords", duplicateId);
      }

      const records = input.records.map((record, index) =>
        buildStudyRecord(draft, input.contestId, input.date, {
          ...record,
          id: ids[index]
        })
      );
      draft.studyRecords.push(...records);
      return { records };
    });
  }
}

export function buildStudyRecord(
  draft: MutableLeifPluginData,
  contestId: string,
  date: string,
  input: RegisterStudyRecordInput & { id: string }
): StudyRecord {
  const subject = draft.subjects.find((entry) => entry.id === input.subjectId);
  if (!subject) {
    throw new NotFoundError("subjects", input.subjectId);
  }
  if (subject.contestId !== contestId) {
    throw new ValidationError("subjectId must belong to the selected contest");
  }

  if (input.resourceId) {
    const resource = draft.resources.find((entry) => entry.id === input.resourceId);
    if (!resource || resource.subjectId !== input.subjectId) {
      throw new ValidationError("resourceId must belong to the selected subject");
    }
  }

  if (input.topicId) {
    const topic = draft.topics.find((entry) => entry.id === input.topicId);
    if (!topic || topic.subjectId !== input.subjectId) {
      throw new ValidationError("topicId must belong to the selected subject");
    }
  }

  return new StudyRecord(
    input.id,
    contestId,
    date,
    input.subjectId,
    input.resourceId,
    input.topicId,
    input.quantity,
    input.unit,
    input.correctAnswers,
    input.completed ?? false,
    input.notes
  );
}
