import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { Contest, ContestExamPlan } from "@/domain/entities/Contest";

export interface UpdateContestInput {
  contestId: string;
  name?: string;
  notes?: string;
  examPlan?: ContestExamPlan;
}

/**
 * Use case for updating a contest.
 */
export class UpdateContestUseCase {
  private readonly contestRepository: EntityRepositoryPort<Contest>;

  constructor(
    private readonly dataStore: PluginDataStore,
    repositoryFactory: RepositoryFactory
  ) {
    this.contestRepository = repositoryFactory.for("contests");
  }

  async execute(input: UpdateContestInput): Promise<Contest> {
    return await this.contestRepository.update(input.contestId, (contest) => ({
      ...contest,
      name: input.name ?? contest.name,
      wall: {
        ...contest.wall,
        notes: input.notes ?? contest.wall.notes
      },
      examPlan:
        input.examPlan !== undefined ? this.normalizeExamPlan(input.examPlan) : contest.examPlan
    }));
  }

  private normalizeExamPlan(examPlan: ContestExamPlan): ContestExamPlan | undefined {
    const next: ContestExamPlan = {};
    const examDate = examPlan.examDate?.trim();
    const board = examPlan.board?.trim();

    if (examDate) {
      next.examDate = examDate;
    }
    if (board) {
      next.board = board;
    }
    if (examPlan.weeklyStudyHours !== undefined && Number.isFinite(examPlan.weeklyStudyHours)) {
      next.weeklyStudyHours = examPlan.weeklyStudyHours;
    }
    if (examPlan.weeklyQuestionGoal !== undefined && Number.isFinite(examPlan.weeklyQuestionGoal)) {
      next.weeklyQuestionGoal = examPlan.weeklyQuestionGoal;
    }

    return Object.keys(next).length > 0 ? next : undefined;
  }
}
