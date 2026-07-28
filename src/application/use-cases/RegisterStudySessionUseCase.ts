import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { createLeifId } from "@/application/Id";
import { RegisterStudySessionValidator } from "@/application/validation/InputValidators";
import { CycleState, type CyclePosition } from "@/domain/entities/CycleState";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { StudySession } from "@/domain/entities/StudySession";
import { CycleService } from "@/domain/services/CycleService";
import type { GoalUnit } from "@/domain/types/GoalUnit";
import { AlreadyExistsError, NotFoundError, ValidationError } from "@/domain/errors/DomainErrors";

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

export interface RegisterStudySessionInput {
  id?: string;
  contestId: string;
  date: string;
  records: RegisterStudyRecordInput[];
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export interface RegisterStudySessionResult {
  session: StudySession;
  cycleAdvanced: boolean;
  previousPosition: CyclePosition;
  newPosition: CyclePosition;
}

export class RegisterStudySessionUseCase {
  private readonly cycleService = new CycleService();

  constructor(
    private readonly dataStore: PluginDataStore,
    _repositoryFactory?: RepositoryFactory
  ) {}

  async execute(input: RegisterStudySessionInput): Promise<RegisterStudySessionResult> {
    const validation = new RegisterStudySessionValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    return this.dataStore.mutate((draft) => {
      const contest = draft.contests.find((entry) => entry.id === input.contestId);
      if (!contest) {
        throw new NotFoundError("contests", input.contestId);
      }

      const sessionId = input.id ?? createLeifId();
      if (draft.studySessions.some((session) => session.id === sessionId)) {
        throw new AlreadyExistsError("studySessions", sessionId);
      }

      const subjects = draft.subjects.filter((subject) => subject.contestId === input.contestId);
      const subjectIds = new Set(subjects.map((subject) => subject.id));
      const resources = draft.resources.filter((resource) => subjectIds.has(resource.subjectId));

      const records = input.records.map((recordInput) => {
        const subject = draft.subjects.find(
          (subjectEntry) => subjectEntry.id === recordInput.subjectId
        );
        if (!subject) {
          throw new NotFoundError("subjects", recordInput.subjectId);
        }
        if (subject.contestId !== input.contestId) {
          throw new ValidationError("subjectId must belong to the selected contest");
        }

        if (recordInput.resourceId) {
          const resource = draft.resources.find((entry) => entry.id === recordInput.resourceId);
          if (!resource || resource.subjectId !== recordInput.subjectId) {
            throw new ValidationError("resourceId must belong to the selected subject");
          }
        }

        if (recordInput.topicId) {
          const topic = draft.topics.find((entry) => entry.id === recordInput.topicId);
          if (!topic || topic.subjectId !== recordInput.subjectId) {
            throw new ValidationError("topicId must belong to the selected subject");
          }
        }

        return new StudyRecord(
          recordInput.id ?? createLeifId(),
          recordInput.subjectId,
          recordInput.resourceId,
          recordInput.topicId,
          recordInput.quantity,
          recordInput.unit,
          recordInput.correctAnswers,
          recordInput.completed ?? false,
          recordInput.notes
        );
      });

      const session = new StudySession(
        sessionId,
        input.contestId,
        input.date,
        records,
        input.startTime,
        input.endTime,
        input.notes
      );

      const stateIndex = draft.cycleStates.findIndex(
        (entry) => entry.contestId === input.contestId
      );
      const existingState = stateIndex >= 0 ? draft.cycleStates[stateIndex] : undefined;
      const state = existingState ?? new CycleState(input.contestId);
      if (stateIndex === -1) {
        draft.cycleStates.push(state);
      }

      const previousPosition = this.cycleService.getRecommendation(
        subjects,
        resources,
        draft.studySessions.filter((entry) => entry.contestId === input.contestId),
        state
      );

      draft.studySessions.push(session);

      if (draft.activeContestId !== input.contestId) {
        return {
          session,
          cycleAdvanced: false,
          previousPosition,
          newPosition: previousPosition
        };
      }

      const advancement = this.cycleService.advanceForCompletedRecords(
        subjects,
        resources,
        draft.studySessions.filter(
          (entry) => entry.contestId === input.contestId && entry.id !== session.id
        ),
        state,
        records
      );
      const newPosition = advancement.advancements > 0 ? advancement.position : previousPosition;
      const updatedState = new CycleState(
        input.contestId,
        newPosition.subjectId,
        newPosition.resourceId
      );
      const updatedStateIndex = draft.cycleStates.findIndex(
        (entry) => entry.contestId === input.contestId
      );
      draft.cycleStates[updatedStateIndex] = updatedState;

      return {
        session,
        cycleAdvanced: advancement.advancements > 0,
        previousPosition,
        newPosition
      };
    });
  }
}
