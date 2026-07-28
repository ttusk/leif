import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { DeleteStudyRecordValidator } from "@/application/validation/InputValidators";
import type { StudyRecord } from "@/domain/entities/StudyRecord";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

export interface DeleteStudyRecordInput {
  recordId: string;
}

export class DeleteStudyRecordUseCase {
  constructor(private readonly dataStore: PluginDataStore) {}

  async execute(input: DeleteStudyRecordInput): Promise<StudyRecord> {
    const validation = new DeleteStudyRecordValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((draft) => {
      const index = draft.studyRecords.findIndex((record) => record.id === input.recordId);
      if (index === -1) {
        throw new NotFoundError("studyRecords", input.recordId);
      }
      const [record] = draft.studyRecords.splice(index, 1);
      return record;
    });
  }
}
