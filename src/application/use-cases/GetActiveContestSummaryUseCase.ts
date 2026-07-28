import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { ActiveContestGuard } from "@/application/guards/ActiveContestGuard";
import { GoalUnit } from "@/domain/types/GoalUnit";

export interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  totalRecords: number;
  pagesRead: number;
  questionsSolved: number;
  minutesStudied: number;
  questionAccuracy: number | null;
  pdfProgressCount: number;
  questionProgressCount: number;
}

export interface ActiveContestSummary {
  contestId: string;
  subjectSummaries: SubjectSummary[];
}

export class GetActiveContestSummaryUseCase {
  private readonly guard: ActiveContestGuard;

  constructor(private readonly dataStore: PluginDataStore) {
    this.guard = new ActiveContestGuard(dataStore);
  }

  async execute(): Promise<ActiveContestSummary> {
    const activeContestId = await this.guard.requireActiveContest();
    const data = await this.dataStore.load();
    const contestSubjects = await this.guard.getActiveContestSubjects();

    const subjectSummaries = contestSubjects.map((subject) => {
      const records = data.studyRecords.filter(
        (record) =>
          record.contestId === activeContestId && record.subjectId === subject.id
      );
      const pagesRead = records
        .filter((record) => record.unit === GoalUnit.PAGINAS)
        .reduce((total, record) => total + (record.quantity ?? 0), 0);
      const questionsSolved = records
        .filter((record) => record.unit === GoalUnit.QUESTOES)
        .reduce((total, record) => total + (record.quantity ?? 0), 0);
      const minutesStudied = records
        .filter((record) => record.unit === GoalUnit.MINUTOS)
        .reduce((total, record) => total + (record.quantity ?? 0), 0);
      const correctAnswers = records.reduce(
        (total, record) => total + (record.correctAnswers ?? 0),
        0
      );

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        totalRecords: records.length,
        pagesRead,
        questionsSolved,
        minutesStudied,
        questionAccuracy:
          questionsSolved > 0 ? Math.min(1, correctAnswers / questionsSolved) : null,
        pdfProgressCount: pagesRead,
        questionProgressCount: questionsSolved
      };
    });

    return {
      contestId: activeContestId,
      subjectSummaries
    };
  }
}
