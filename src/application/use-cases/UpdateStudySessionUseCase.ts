import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { StudySession } from "@/domain/entities/StudySession";
import { ValidationError } from "@/domain/errors/DomainErrors";

export interface UpdateStudySessionInput {
  sessionId: string;
  pagesOrCount?: number;
  correctAnswers?: number;
}

/**
 * Use case for updating a study session's progress.
 */
export class UpdateStudySessionUseCase {
  private readonly sessionRepository: EntityRepositoryPort<StudySession>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.sessionRepository = repositoryFactory.for<StudySession>("studySessions");
  }

  async execute(input: UpdateStudySessionInput): Promise<StudySession> {
    if (!input.sessionId?.trim()) {
      throw new ValidationError("sessionId is required");
    }
    if (input.pagesOrCount !== undefined && input.pagesOrCount < 0) {
      throw new ValidationError("pagesOrCount cannot be negative");
    }
    if (input.correctAnswers !== undefined && input.correctAnswers < 0) {
      throw new ValidationError("correctAnswers cannot be negative");
    }

    return await this.sessionRepository.update(input.sessionId, (session) => {
      const newCount = input.pagesOrCount !== undefined ? input.pagesOrCount : session.pagesOrCount;
      const newCorrect = input.correctAnswers !== undefined ? input.correctAnswers : session.correctAnswers;

      if (newCorrect !== undefined && newCount !== undefined && newCorrect > newCount) {
        throw new ValidationError("correctAnswers cannot exceed pagesOrCount");
      }

      return {
        ...session,
        pagesOrCount: newCount,
        correctAnswers: newCorrect
      };
    });
  }
}
