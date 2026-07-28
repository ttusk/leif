import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { ActiveContestGuard } from "@/application/guards/ActiveContestGuard";
import { GoalProgressService } from "@/domain/services/GoalProgressService";
import { GoalUnit } from "@/domain/types/GoalUnit";

export interface ResourceProgress {
  resourceId: string;
  title: string;
  order: number;
  progress: number;
  goal?: number;
  unit?: string;
  completed: boolean;
}

export interface SubjectResourceProgress {
  subjectId: string;
  subjectName: string;
  resources: ResourceProgress[];
  items: ResourceProgress[];
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
  resourceProgressBySubject: SubjectResourceProgress[];
  questionProgressBySubject: SubjectQuestionProgress[];
  pdfProgressBySubject: SubjectResourceProgress[];
}

export class GetActiveContestProgressDashboardUseCase {
  private readonly guard: ActiveContestGuard;
  private readonly progress = new GoalProgressService();

  constructor(private readonly dataStore: PluginDataStore) {
    this.guard = new ActiveContestGuard(dataStore);
  }

  async execute(): Promise<ActiveContestProgressDashboard> {
    const activeContestId = await this.guard.requireActiveContest();
    const data = await this.dataStore.load();
    const contestSubjects = await this.guard.getActiveContestSubjects();
    const contestSessions = data.studySessions.filter(
      (session) => session.contestId === activeContestId
    );

    const resourceProgressBySubject = contestSubjects.map((subject) => {
      const resources = data.resources
        .filter((resource) => resource.subjectId === subject.id)
        .sort((left, right) => left.order - right.order)
        .map((resource) => ({
          resourceId: resource.id,
          title: resource.title,
          order: resource.order,
          progress: this.progress.progressFor(resource, contestSessions),
          goal: resource.goal?.amount,
          unit: resource.goal?.unit,
          completed: this.progress.isComplete(resource, contestSessions)
        }));

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        resources,
        items: resources,
        totalProgressCount: resources.reduce((total, resource) => total + resource.progress, 0)
      };
    });

    const questionProgressBySubject = contestSubjects.map((subject) => {
      const groupedByDate = new Map<string, { questionCount: number; correctAnswers: number }>();

      contestSessions.forEach((session) => {
        session.records
          .filter((record) => record.subjectId === subject.id && record.unit === GoalUnit.QUESTOES)
          .forEach((record) => {
            const current = groupedByDate.get(session.date) ?? {
              questionCount: 0,
              correctAnswers: 0
            };
            groupedByDate.set(session.date, {
              questionCount: current.questionCount + (record.quantity ?? 0),
              correctAnswers: current.correctAnswers + (record.correctAnswers ?? 0)
            });
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
      resourceProgressBySubject,
      questionProgressBySubject,
      pdfProgressBySubject: resourceProgressBySubject
    };
  }
}
