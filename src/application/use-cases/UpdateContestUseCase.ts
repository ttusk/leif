import { Contest, type ContestExamPlan } from "@/domain/entities/Contest";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { RepositoryFactory } from "@/application/ports/EntityRepository";

export interface UpdateContestInput {
  contestId: string;
  name?: string;
  examPlan?: ContestExamPlan;
}

const normalizeExamPlan = (examPlan?: ContestExamPlan): ContestExamPlan | undefined => {
  if (!examPlan) {
    return undefined;
  }

  const normalized: ContestExamPlan = {};
  if (typeof examPlan.examDate === "string" && examPlan.examDate.trim()) {
    normalized.examDate = examPlan.examDate.trim();
  }
  if (typeof examPlan.board === "string" && examPlan.board.trim()) {
    normalized.board = examPlan.board.trim();
  }
  if (typeof examPlan.weeklyStudyHours === "number" && Number.isFinite(examPlan.weeklyStudyHours)) {
    normalized.weeklyStudyHours = examPlan.weeklyStudyHours;
  }
  if (
    typeof examPlan.weeklyQuestionGoal === "number" &&
    Number.isFinite(examPlan.weeklyQuestionGoal)
  ) {
    normalized.weeklyQuestionGoal = examPlan.weeklyQuestionGoal;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

export class UpdateContestUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly repositoryFactory: RepositoryFactory
  ) {}

  async execute(input: UpdateContestInput): Promise<Contest> {
    const contestRepository = this.repositoryFactory.for("contests");

    return contestRepository.update(input.contestId, (contest) => {
      const examPlan = normalizeExamPlan(input.examPlan) ?? contest.examPlan;
      return new Contest(
        contest.id,
        input.name?.trim() ? input.name.trim() : contest.name,
        [...contest.subjectIds],
        contest.mural,
        examPlan
      );
    });
  }
}
