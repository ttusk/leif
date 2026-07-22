import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { GetActiveContestSummaryUseCase } from "@/application/use-cases/GetActiveContestSummaryUseCase";
import { GetActiveContestProgressDashboardUseCase } from "@/application/use-cases/GetActiveContestProgressDashboardUseCase";
import { GetActiveCycleSnapshotUseCase } from "@/application/use-cases/GetActiveCycleSnapshotUseCase";
import type { Subject } from "@/domain/entities/Subject";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import type { LeifTabId } from "@/ui/constants";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";

/**
 * Dashboard tab component - shows contest overview and summary.
 */
export class DashboardTab {
  private readonly getActiveCycleSnapshotUseCase: GetActiveCycleSnapshotUseCase;
  private readonly getActiveContestSummaryUseCase: GetActiveContestSummaryUseCase;
  private readonly getActiveContestProgressDashboardUseCase: GetActiveContestProgressDashboardUseCase;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onNavigate: (tabId: LeifTabId) => Promise<void>
  ) {
    this.getActiveCycleSnapshotUseCase = new GetActiveCycleSnapshotUseCase(dataStore);
    this.getActiveContestSummaryUseCase = new GetActiveContestSummaryUseCase(dataStore);
    this.getActiveContestProgressDashboardUseCase = new GetActiveContestProgressDashboardUseCase(
      dataStore
    );
  }

  /**
   * Renders the dashboard tab content.
   */
  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    const activeContest =
      data.contests.find((contest) => contest.id === data.activeContestId) ?? null;

    if (!activeContest) {
      container.append(
        DomHelpers.createSectionTitle("Hoje"),
        DomHelpers.createEmptyState(
          "Nada escolhido ainda",
          "Escolha um concurso para o Leif saber por onde começar."
        )
      );
      return;
    }

    const snapshot = await this.getActiveCycleSnapshotUseCase.execute();
    const summary = await this.getActiveContestSummaryUseCase.execute();
    const progress = await this.getActiveContestProgressDashboardUseCase.execute();
    const itemMap = new Map(data.studyItems.map((item) => [item.id, item.title]));
    const recommendedSubject = snapshot.currentSubject ?? snapshot.nextSubject;
    const afterRecommendedSubject =
      snapshot.currentSubject && snapshot.nextSubject?.id !== snapshot.currentSubject.id
        ? snapshot.nextSubject
        : this.findFollowingActiveSubject(data, activeContest.id, recommendedSubject?.id);
    const recommendedItemId = snapshot.currentItemId ?? snapshot.nextItemId;
    const afterRecommendedItemId = snapshot.currentItemId ? snapshot.nextItemId : null;

    container.appendChild(DomHelpers.createSectionTitle("Hoje"));
    container.appendChild(
      DomHelpers.createParagraph("O que estudar agora e como o dia está andando.")
    );
    const examPlanPanel = this.renderExamPlanPanel(activeContest);
    if (examPlanPanel) {
      container.appendChild(examPlanPanel);
    }
    container.appendChild(
      this.renderNextActivityPanel({
        subjectName: recommendedSubject?.name ?? "Sem matéria ativa",
        itemName: recommendedSubject
          ? (itemMap.get(recommendedItemId ?? "") ?? "Sem item definido")
          : "Crie ou ative uma matéria em Matérias para aparecer aqui.",
        plannedMinutes: recommendedSubject?.plannedStudyMinutes,
        stage: recommendedSubject?.currentStage,
        nextSubjectName: afterRecommendedSubject?.name,
        nextItemName: itemMap.get(afterRecommendedItemId ?? ""),
        canRegisterStudy: Boolean(recommendedSubject),
        recommendationReason: recommendedSubject
          ? this.buildRecommendationReason(data, recommendedSubject.id)
          : undefined
      })
    );

    // Subject summary card
    const subjectSummaryCard = DomHelpers.createCard("Resumo por matéria");
    const progressMap = new Map(progress.pdfProgressBySubject.map((s) => [s.subjectId, s]));
    const rows = summary.subjectSummaries.map((subjectSummary) => {
      const subjectProgress = progressMap.get(subjectSummary.subjectId);
      const totalPages =
        subjectProgress?.items.reduce((sum, item) => sum + (item.totalPages ?? 0), 0) ?? 0;
      const readPages = subjectProgress?.totalProgressCount ?? 0;
      const progressBar = DomHelpers.createProgressBar(
        readPages,
        totalPages > 0 ? totalPages : undefined
      );
      return [
        subjectSummary.subjectName,
        String(subjectSummary.totalSessions),
        progressBar,
        String(subjectSummary.questionProgressCount),
        subjectSummary.questionAccuracy === null
          ? "-"
          : `${Math.round(subjectSummary.questionAccuracy * 100)}%`
      ];
    });

    if (rows.length === 0) {
      subjectSummaryCard.appendChild(
        DomHelpers.createParagraph(
          "Quando você começar a registrar estudos, o resumo aparece aqui."
        )
      );
    } else {
      subjectSummaryCard.appendChild(
        DomHelpers.createTable(["Matéria", "Sessões", "Páginas", "Questões", "Acerto"], rows)
      );
    }
    container.appendChild(subjectSummaryCard);
  }

  private renderExamPlanPanel(
    contest: NonNullable<LeifPluginData["contests"][number]>
  ): HTMLElement | null {
    const plan = contest.examPlan;
    if (
      !plan?.examDate &&
      !plan?.board &&
      plan?.weeklyStudyHours === undefined &&
      plan?.weeklyQuestionGoal === undefined
    ) {
      return null;
    }

    const panel = DomHelpers.createElement("section", "leif-next-activity leif-exam-plan");
    const intro = DomHelpers.createElement("div", "leif-next-activity-intro");
    const label = DomHelpers.createElement("span", "leif-next-activity-label");
    label.textContent = "Prova";
    const title = DomHelpers.createElement("strong", "leif-next-activity-subject");
    title.textContent = plan?.examDate
      ? `Prova em ${this.formatDaysUntilExam(plan.examDate)}`
      : "Planejamento da prova";
    const details = DomHelpers.createElement("span", "leif-next-activity-item");
    details.textContent = plan?.examDate
      ? this.formatDate(plan.examDate)
      : "Data ainda não definida";
    intro.append(label, title, details);

    const meta = DomHelpers.createElement("div", "leif-next-activity-meta");
    if (plan?.board) {
      meta.appendChild(this.renderActivityMeta("Banca", plan.board));
    }
    if (plan?.weeklyStudyHours !== undefined) {
      meta.appendChild(this.renderActivityMeta("Carga", `${plan.weeklyStudyHours} h/semana`));
    }
    if (plan?.weeklyQuestionGoal !== undefined) {
      meta.appendChild(
        this.renderActivityMeta("Meta", `${plan.weeklyQuestionGoal} questões/semana`)
      );
    }

    panel.append(intro, meta);
    return panel;
  }

  private renderNextActivityPanel(activity: {
    subjectName: string;
    itemName: string;
    plannedMinutes?: number;
    stage?: string;
    nextSubjectName?: string;
    nextItemName?: string;
    canRegisterStudy?: boolean;
    recommendationReason?: string;
  }): HTMLElement {
    const panel = DomHelpers.createElement("section", "leif-next-activity");
    const intro = DomHelpers.createElement("div", "leif-next-activity-intro");
    const label = DomHelpers.createElement("span", "leif-next-activity-label");
    label.textContent = "Estudar agora";
    const subject = DomHelpers.createElement("strong", "leif-next-activity-subject");
    subject.textContent = activity.subjectName;
    const item = DomHelpers.createElement("span", "leif-next-activity-item");
    item.textContent = activity.itemName;
    intro.append(label, subject, item);
    if (activity.recommendationReason) {
      const reason = DomHelpers.createElement("span", "leif-recommendation-reason");
      reason.textContent = activity.recommendationReason;
      intro.appendChild(reason);
    }

    const meta = DomHelpers.createElement("div", "leif-next-activity-meta");
    meta.append(
      this.renderActivityMeta(
        "Tempo",
        activity.plannedMinutes ? `${activity.plannedMinutes} min` : "sem tempo definido"
      ),
      this.renderActivityMeta("Etapa", activity.stage?.trim() ? activity.stage : "sem etapa")
    );

    if (activity.canRegisterStudy) {
      meta.appendChild(
        DomHelpers.createButton("Ir para Registros", {
          icon: "arrow-right",
          className: "leif-next-activity-action",
          onClick: () => this.onNavigate("sessions")
        })
      );
    }

    panel.append(intro, meta);

    if (activity.canRegisterStudy) {
      const route = DomHelpers.createElement("ol", "leif-cycle-thread leif-next-activity-next");
      route.setAttribute("aria-label", "Ordem atual do ciclo");

      const current = DomHelpers.createElement("li", "leif-cycle-thread-step is-current");
      current.dataset.cycleState = "current";
      current.setAttribute("aria-current", "step");
      const currentState = DomHelpers.createElement("span", "leif-cycle-thread-state");
      currentState.textContent = "Agora";
      const currentSubject = DomHelpers.createElement("strong", "leif-cycle-thread-subject");
      currentSubject.textContent = activity.subjectName;
      current.append(currentState, currentSubject);

      route.appendChild(current);
      if (activity.nextSubjectName || activity.nextItemName) {
        const next = DomHelpers.createElement("li", "leif-cycle-thread-step is-next");
        next.dataset.cycleState = "next";
        const nextState = DomHelpers.createElement("span", "leif-cycle-thread-state");
        nextState.textContent = "Próxima";
        const nextDescription = DomHelpers.createElement("span", "leif-cycle-thread-subject");
        nextDescription.textContent = [
          activity.nextSubjectName ? `Próxima matéria: ${activity.nextSubjectName}` : undefined,
          activity.nextItemName ? `item na fila: ${activity.nextItemName}` : undefined
        ]
          .filter(Boolean)
          .join(" · ");
        next.append(nextState, nextDescription);
        route.appendChild(next);
      }
      panel.appendChild(route);
    }

    return panel;
  }

  private renderActivityMeta(label: string, value: string): HTMLElement {
    return DomHelpers.createMetric(label, value);
  }

  private buildRecommendationReason(data: LeifPluginData, subjectId: string): string {
    const lastSession = data.studySessions
      .filter((session) => session.subjectId === subjectId)
      .slice()
      .sort((left, right) => right.studiedAt.localeCompare(left.studiedAt))[0];

    if (!lastSession) {
      return "Próxima no ciclo · ainda não estudada";
    }

    return `Próxima no ciclo · último estudo em ${new Date(
      lastSession.studiedAt
    ).toLocaleDateString("pt-BR")}`;
  }

  private formatDaysUntilExam(examDate: string): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [year, month, day] = examDate.split("-").map(Number);

    if (!year || !month || !day) {
      return "data indefinida";
    }

    const target = new Date(year, month - 1, day);
    const days = Math.ceil((target.getTime() - today.getTime()) / 86400000);

    if (days < 0) {
      return "data já passou";
    }
    if (days === 0) {
      return "hoje";
    }

    return `${days} dias`;
  }

  private formatDate(value: string): string {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) {
      return value;
    }
    return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
  }

  private findFollowingActiveSubject(
    data: LeifPluginData,
    contestId: string,
    subjectId?: string
  ): Subject | null {
    if (!subjectId) return null;

    const activeSubjects = data.subjects
      .filter((subject) => subject.contestId === contestId && subject.isActive)
      .slice()
      .sort((a, b) => a.order - b.order);

    if (activeSubjects.length < 2) return null;

    const currentIndex = activeSubjects.findIndex((subject) => subject.id === subjectId);
    if (currentIndex === -1) return null;

    return activeSubjects[(currentIndex + 1) % activeSubjects.length] ?? null;
  }
}
