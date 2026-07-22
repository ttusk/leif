import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { RegisterStudySessionValidator } from "@/application/validation/InputValidators";
import { StudySession, StudySessionType } from "@/domain/entities/StudySession";
import type { Subject } from "@/domain/entities/Subject";
import { AlreadyExistsError, NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";
import { CycleService } from "@/domain/services/CycleService";
import { ItemProgressService } from "@/domain/services/ItemProgressService";

export type RegisterRecommendedStudySessionInput = StudySession;

export interface CyclePosition {
  subjectId: string | null;
  itemId: string | null;
}

export interface RegisterRecommendedStudySessionResult {
  session: StudySession;
  cycleAdvanced: boolean;
  previousPosition: CyclePosition;
  newPosition: CyclePosition;
}

/**
 * Registers a study session and, when it completes the currently recommended
 * subject/item, advances the active cycle in the same persisted mutation.
 */
export class RegisterRecommendedStudySessionUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly cycleService: CycleService = new CycleService(),
    private readonly progressService: ItemProgressService = new ItemProgressService()
  ) {}

  async execute(
    input: RegisterRecommendedStudySessionInput
  ): Promise<RegisterRecommendedStudySessionResult> {
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

      const stateIndex = data.contestStates.findIndex(
        (state) => state.contestId === input.contestId
      );
      const state = stateIndex >= 0 ? data.contestStates[stateIndex] : undefined;
      const previousPosition: CyclePosition = {
        subjectId: state?.currentSubjectId ?? null,
        itemId: state?.currentItemId ?? null
      };

      const activeSubjects = data.subjects
        .filter((candidate) => candidate.contestId === input.contestId && candidate.isActive)
        .sort((left, right) => left.order - right.order);
      this.requireValidSubjectOrders(activeSubjects);

      const recommendedSubject =
        activeSubjects.find((candidate) => candidate.id === state?.currentSubjectId) ??
        this.cycleService.getNextActiveSubject(
          activeSubjects,
          state?.currentSubjectId ?? undefined
        );
      const recommendedItemId = recommendedSubject
        ? (state?.currentItemId ??
          this.firstIncompleteItemId(recommendedSubject, data.studyItems, data.studySessions))
        : null;

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

      const matchesRecommendation =
        input.completed === true &&
        data.activeContestId === input.contestId &&
        recommendedSubject !== null &&
        input.subjectId === recommendedSubject.id &&
        (input.studyItemId ?? null) === recommendedItemId;

      let newPosition = previousPosition;
      if (matchesRecommendation && stateIndex >= 0) {
        const nextSubject = this.cycleService.getNextActiveSubject(
          activeSubjects,
          recommendedSubject.id
        );
        newPosition = {
          subjectId: nextSubject?.id ?? null,
          itemId: nextSubject
            ? this.firstIncompleteItemId(nextSubject, data.studyItems, data.studySessions)
            : null
        };
        data.contestStates[stateIndex] = {
          ...data.contestStates[stateIndex],
          currentSubjectId: newPosition.subjectId,
          currentItemId: newPosition.itemId
        };
      }

      return {
        session,
        cycleAdvanced: matchesRecommendation && stateIndex >= 0,
        previousPosition,
        newPosition
      };
    });
  }

  private firstIncompleteItemId(
    subject: Subject,
    items: Parameters<ItemProgressService["buildCompletionPredicate"]>[0],
    sessions: Parameters<ItemProgressService["buildCompletionPredicate"]>[1]
  ): string | null {
    const subjectItems = items.filter((item) => item.subjectId === subject.id);
    const isCompleted = this.progressService.buildCompletionPredicate(subjectItems, sessions);
    return this.cycleService.getNextItemId(subject, undefined, isCompleted);
  }

  private requireValidSubjectOrders(subjects: Subject[]): void {
    if (subjects.some((subject) => subject.order < 1)) {
      throw new ValidationError("Active subject order must be at least 1");
    }
  }
}
