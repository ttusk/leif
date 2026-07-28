import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { StudySession } from "@/domain/entities/StudySession";
import { NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import { DeleteStudySessionValidator } from "@/application/validation/InputValidators";

export interface DeleteStudySessionInput {
  sessionId: string;
}

export class DeleteStudySessionUseCase {
  constructor(private readonly dataStore: PluginDataStore) {}

  async execute(input: DeleteStudySessionInput): Promise<StudySession> {
    const validation = new DeleteStudySessionValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((draft) => {
      const index = draft.studySessions.findIndex((session) => session.id === input.sessionId);
      if (index === -1) {
        throw new NotFoundError("studySessions", input.sessionId);
      }
      const [session] = draft.studySessions.splice(index, 1);
      return session;
    });
  }
}
