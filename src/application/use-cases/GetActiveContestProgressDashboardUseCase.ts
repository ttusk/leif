import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { StudySessionType } from "@/domain/entities/StudySession";
import { ActiveContestGuard } from "@/application/guards/ActiveContestGuard";

export interface PdfItemProgress {
  studyItemId: string;
  title: string;
  order: number;
  progressCount: number;
  pagesReaded: number;
  totalPages?: number;
  completed: boolean;
  weight?: number;
  questionCount?: number;
}

export interface SubjectPdfProgress {
  subjectId: string;
  subjectName: string;
  items: PdfItemProgress[];
  totalProgressCount: number;
}

export interface SubjectQuestionProgressPoint {
  date: string;
  questionCount: number;
  correctAnswers: number;
  accuracy: number | null;
}

export interface SubjectQuestionProgress {
  subjectId: string;
  subjectName: string;
  points: SubjectQuestionProgressPoint[];
  totalQuestionCount: number;
  totalCorrectAnswers: number;
  totalAccuracy: number | null;
}

export interface ActiveContestProgressDashboard {
  contestId: string;
  pdfProgressBySubject: SubjectPdfProgress[];
  questionProgressBySubject: SubjectQuestionProgress[];
}

/**
 * Use case for getting the active contest progress dashboard.
 */
export class GetActiveContestProgressDashboardUseCase {
  private readonly guard: ActiveContestGuard;

  constructor(private readonly dataStore: PluginDataStore) {
    this.guard = new ActiveContestGuard(dataStore);
  }

  async execute(): Promise<ActiveContestProgressDashboard> {
    const activeContestId = await this.guard.requireActiveContest();
    const data = await this.dataStore.load();

    const contestSubjects = await this.guard.getActiveContestSubjects();

    const pdfProgressBySubject = contestSubjects.map((subject) => {
      const subjectItems = data.studyItems
        .filter((studyItem) => studyItem.subjectId === subject.id)
        .sort((left, right) => left.order - right.order);

      const items = subjectItems.map((studyItem) => {
        const pagesReaded = data.studySessions
          .filter(
            (session) =>
              session.contestId === activeContestId &&
              session.type === StudySessionType.PDF &&
              session.studyItemId === studyItem.id
          )
          .reduce((total, session) => total + (session.pagesOrCount ?? 0), 0);

        return {
          studyItemId: studyItem.id,
          title: studyItem.title,
          order: studyItem.order,
          progressCount: pagesReaded,
          pagesReaded,
          totalPages: studyItem.totalPages,
          completed:
            studyItem.totalPages !== undefined && studyItem.totalPages > 0
              ? pagesReaded >= studyItem.totalPages
              : false,
          weight: studyItem.weight,
          questionCount: studyItem.questionCount
        };
      });

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        items,
        totalProgressCount: items.reduce((total, item) => total + item.progressCount, 0)
      };
    });

    const questionProgressBySubject = contestSubjects.map((subject) => {
      const groupedByDate = new Map<string, { questionCount: number; correctAnswers: number }>();

      data.studySessions
        .filter(
          (session) =>
            session.contestId === activeContestId &&
            session.subjectId === subject.id &&
            session.type === StudySessionType.QUESTIONS
        )
        .forEach((session) => {
          const date = session.studiedAt.slice(0, 10);
          const current = groupedByDate.get(date) ?? { questionCount: 0, correctAnswers: 0 };

          groupedByDate.set(date, {
            questionCount: current.questionCount + (session.pagesOrCount ?? 0),
            correctAnswers: current.correctAnswers + (session.correctAnswers ?? 0)
          });
        });

      const points = Array.from(groupedByDate.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, point]) => ({
          date,
          questionCount: point.questionCount,
          correctAnswers: point.correctAnswers,
          accuracy: point.questionCount > 0 ? point.correctAnswers / point.questionCount : null
        }));

      const totalQuestionCount = points.reduce((total, point) => total + point.questionCount, 0);
      const totalCorrectAnswers = points.reduce((total, point) => total + point.correctAnswers, 0);

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        points,
        totalQuestionCount,
        totalCorrectAnswers,
        totalAccuracy: totalQuestionCount > 0 ? totalCorrectAnswers / totalQuestionCount : null
      };
    });

    return {
      contestId: activeContestId,
      pdfProgressBySubject,
      questionProgressBySubject
    };
  }
}
