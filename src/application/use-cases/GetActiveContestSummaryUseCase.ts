import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { StudySessionType } from "@/domain/entities/StudySession";
import { ActiveContestGuard } from "@/application/guards/ActiveContestGuard";

export interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  totalSessions: number;
  pdfProgressCount: number;
  questionProgressCount: number;
  questionAccuracy: number | null;
}

export interface ActiveContestSummary {
  contestId: string;
  subjectSummaries: SubjectSummary[];
}

/**
 * Use case for getting the active contest summary.
 */
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
      const subjectSessions = data.studySessions.filter(
        (session) => session.contestId === activeContestId && session.subjectId === subject.id
      );

      const pdfProgressCount = subjectSessions
        .filter((session) => session.type === StudySessionType.PDF)
        .reduce((total, session) => total + (session.pagesOrCount ?? 0), 0);

      const questionSessions = subjectSessions.filter(
        (session) => session.type === StudySessionType.QUESTIONS
      );
      const questionProgressCount = questionSessions.reduce(
        (total, session) => total + (session.pagesOrCount ?? 0),
        0
      );
      const totalCorrectAnswers = questionSessions.reduce(
        (total, session) => total + (session.correctAnswers ?? 0),
        0
      );

      const rawAccuracy =
        questionProgressCount > 0 ? totalCorrectAnswers / questionProgressCount : 0;

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        totalSessions: subjectSessions.length,
        pdfProgressCount,
        questionProgressCount,
        questionAccuracy: questionProgressCount > 0 ? Math.min(1, rawAccuracy) : null
      };
    });

    return {
      contestId: activeContestId,
      subjectSummaries
    };
  }
}
