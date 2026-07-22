import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import { StudySession, StudySessionType } from "@/domain/entities/StudySession";
import type { Topic } from "@/domain/entities/Topic";
import type { Contest } from "@/domain/entities/Contest";
import type { Subject } from "@/domain/entities/Subject";
import { AlreadyExistsError, NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import { RegisterStudySessionValidator } from "@/application/validation/InputValidators";

export type RegisterStudySessionInput = StudySession;

/**
 * Use case for registering a new study session.
 */
export class RegisterStudySessionUseCase {
  private readonly contestRepository: EntityRepositoryPort<Contest>;
  private readonly subjectRepository: EntityRepositoryPort<Subject>;
  private readonly topicRepository: EntityRepositoryPort<Topic>;
  private readonly sessionRepository: EntityRepositoryPort<StudySession>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.contestRepository = repositoryFactory.for("contests");
    this.subjectRepository = repositoryFactory.for("subjects");
    this.topicRepository = repositoryFactory.for("topics");
    this.sessionRepository = repositoryFactory.for("studySessions");
  }

  async execute(input: RegisterStudySessionInput): Promise<StudySession> {
    const validation = new RegisterStudySessionValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((data) => {
      if (!data.contests.some((contest) => contest.id === input.contestId)) {
        throw new NotFoundError("contests", input.contestId);
      }
      if (data.studySessions.some((session) => session.id === input.id)) {
        throw new AlreadyExistsError("studySessions", input.id);
      }
      const subject = input.subjectId
        ? data.subjects.find((candidate) => candidate.id === input.subjectId)
        : undefined;
      if (input.subjectId && (!subject || subject.contestId !== input.contestId)) {
        throw new ValidationError("subjectId must belong to the selected contest");
      }
      if (
        input.studyItemId &&
        !data.studyItems.some(
          (item) => item.id === input.studyItemId && item.subjectId === input.subjectId
        )
      ) {
        throw new ValidationError("studyItemId must belong to the selected subject");
      }
      const topicIndex = input.topicId
        ? data.topics.findIndex(
            (topic) => topic.id === input.topicId && topic.subjectId === input.subjectId
          )
        : -1;
      if (input.topicId && topicIndex === -1) {
        throw new ValidationError("topicId must belong to the selected subject");
      }

      const session = new StudySession(
        input.id,
        input.contestId,
        input.type,
        input.studiedAt,
        input.subjectId,
        input.studyItemId,
        input.topicId,
        input.phase,
        input.reference,
        input.pagesOrCount,
        input.correctAnswers,
        input.completed
      );
      data.studySessions.push(session);

      if (
        session.type === StudySessionType.QUESTIONS &&
        topicIndex >= 0 &&
        data.topics[topicIndex].questionNotebook
      ) {
        const topic = data.topics[topicIndex];
        data.topics[topicIndex] = {
          ...topic,
          questionNotebook: {
            ...topic.questionNotebook!,
            solvedQuestions: topic.questionNotebook!.solvedQuestions + (session.pagesOrCount ?? 0),
            correctAnswers: topic.questionNotebook!.correctAnswers + (session.correctAnswers ?? 0)
          }
        };
      }
      return session;
    });
  }
}
