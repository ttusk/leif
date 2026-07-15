import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { GetActiveContestSummaryUseCase } from "@/application/use-cases/GetActiveContestSummaryUseCase";
import { GetActiveContestProgressDashboardUseCase } from "@/application/use-cases/GetActiveContestProgressDashboardUseCase";
import { GetActiveCycleSnapshotUseCase } from "@/application/use-cases/GetActiveCycleSnapshotUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { createId } from "@/application/Id";
import type { Subject } from "@/domain/entities/Subject";
import { StudySessionType } from "@/domain/entities/StudySession";
import { ValidationError } from "@/domain/errors/DomainErrors";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";

/**
 * Dashboard tab component - shows contest overview and summary.
 */
export class DashboardTab {
  private readonly getActiveCycleSnapshotUseCase: GetActiveCycleSnapshotUseCase;
  private readonly getActiveContestSummaryUseCase: GetActiveContestSummaryUseCase;
  private readonly getActiveContestProgressDashboardUseCase: GetActiveContestProgressDashboardUseCase;
  private readonly registerStudySessionUseCase: RegisterStudySessionUseCase;
  private isRegisteringNextActivity = false;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.getActiveCycleSnapshotUseCase = new GetActiveCycleSnapshotUseCase(dataStore);
    this.getActiveContestSummaryUseCase = new GetActiveContestSummaryUseCase(dataStore);
    this.getActiveContestProgressDashboardUseCase = new GetActiveContestProgressDashboardUseCase(dataStore);
    this.registerStudySessionUseCase = new RegisterStudySessionUseCase(dataStore, repositoryFactory);
  }

  /**
   * Renders the dashboard tab content.
   */
  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId) ?? null;

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
          ? itemMap.get(recommendedItemId ?? "") ?? "Sem item definido"
          : "Crie ou ative uma matéria no Plano para aparecer aqui.",
        plannedMinutes: recommendedSubject?.plannedStudyMinutes,
        stage: recommendedSubject?.currentStage,
        nextSubjectName: afterRecommendedSubject?.name,
        nextItemName: itemMap.get(afterRecommendedItemId ?? ""),
        onRegister: recommendedSubject
          ? async () => {
              this.isRegisteringNextActivity = true;
              await this.onUpdate();
            }
          : undefined,
        registerForm: this.isRegisteringNextActivity && recommendedSubject
          ? this.renderRecommendedSessionForm({
              contestId: activeContest.id,
              subjectId: recommendedSubject.id,
              subjectName: recommendedSubject.name,
              itemId: recommendedItemId ?? undefined,
              itemName: itemMap.get(recommendedItemId ?? "") ?? undefined
            })
          : undefined
      })
    );

    // Subject summary card
    const subjectSummaryCard = DomHelpers.createCard("Resumo por matéria");
    const progressMap = new Map(progress.pdfProgressBySubject.map((s) => [s.subjectId, s]));
    const rows = summary.subjectSummaries.map((subjectSummary) => {
      const subjectProgress = progressMap.get(subjectSummary.subjectId);
      const totalPages = subjectProgress?.items.reduce((sum, item) => sum + (item.totalPages ?? 0), 0) ?? 0;
      const readPages = subjectProgress?.totalProgressCount ?? 0;
      const progressBar = DomHelpers.createProgressBar(readPages, totalPages > 0 ? totalPages : undefined);
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
        DomHelpers.createParagraph("Quando você começar a registrar estudos, o resumo aparece aqui.")
      );
    } else {
      subjectSummaryCard.appendChild(
        DomHelpers.createTable(
          ["Matéria", "Sessões", "Páginas", "Questões", "Acerto"],
          rows
        )
      );
    }
    container.appendChild(subjectSummaryCard);
  }

  private renderExamPlanPanel(contest: NonNullable<LeifPluginData["contests"][number]>): HTMLElement | null {
    const plan = contest.examPlan;
    if (!plan?.examDate && !plan?.board && plan?.weeklyStudyHours === undefined && plan?.weeklyQuestionGoal === undefined) {
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
    details.textContent = plan?.examDate ? this.formatDate(plan.examDate) : "Data ainda não definida";
    intro.append(label, title, details);

    const meta = DomHelpers.createElement("div", "leif-next-activity-meta");
    if (plan?.board) {
      meta.appendChild(this.renderActivityMeta("Banca", plan.board));
    }
    if (plan?.weeklyStudyHours !== undefined) {
      meta.appendChild(this.renderActivityMeta("Carga", `${plan.weeklyStudyHours} h/semana`));
    }
    if (plan?.weeklyQuestionGoal !== undefined) {
      meta.appendChild(this.renderActivityMeta("Meta", `${plan.weeklyQuestionGoal} questões/semana`));
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
    onRegister?: () => void | Promise<void>;
    registerForm?: HTMLElement;
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

    const meta = DomHelpers.createElement("div", "leif-next-activity-meta");
    meta.append(
      this.renderActivityMeta("Tempo", activity.plannedMinutes ? `${activity.plannedMinutes} min` : "sem tempo definido"),
      this.renderActivityMeta("Etapa", activity.stage?.trim() ? activity.stage : "sem etapa")
    );

    if (activity.nextSubjectName || activity.nextItemName) {
      const next = DomHelpers.createElement("div", "leif-next-activity-next");
      next.textContent = [
        activity.nextSubjectName ? `Depois vem ${activity.nextSubjectName}` : undefined,
        activity.nextItemName ? `na fila: ${activity.nextItemName}` : undefined
      ].filter(Boolean).join(" · ");
      meta.appendChild(next);
    }

    if (activity.onRegister) {
      meta.appendChild(
        DomHelpers.createButton("Registrar agora", {
          className: "mod-cta",
          onClick: activity.onRegister
        })
      );
    }

    panel.append(intro, meta);
    if (activity.registerForm) {
      panel.appendChild(activity.registerForm);
    }
    return panel;
  }

  private renderActivityMeta(label: string, value: string): HTMLElement {
    return DomHelpers.createMetric(label, value);
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

  private renderRecommendedSessionForm(activity: {
    contestId: string;
    subjectId: string;
    subjectName: string;
    itemId?: string;
    itemName?: string;
  }): HTMLElement {
    const typeSelect = DomHelpers.createSelect([
      [StudySessionType.PDF, "PDF"],
      [StudySessionType.VIDEO, "Vídeo"],
      [StudySessionType.QUESTIONS, "Questões"]
    ]);
    const countInput = DomHelpers.createInput("number", "Páginas ou quantidade", "0");
    const correctInput = DomHelpers.createInput("number", "Acertos", "0");
    const correctLabel = DomHelpers.createLabel("Acertos", correctInput);
    const dateInput = DomHelpers.createInput("date", "Data");
    dateInput.value = this.getDefaultDateValue();

    const syncQuestionField = (): void => {
      correctLabel.style.display = typeSelect.value === StudySessionType.QUESTIONS ? "" : "none";
    };
    typeSelect.addEventListener("change", syncQuestionField);
    syncQuestionField();

    const form = DomHelpers.createForm(async () => {
      try {
        const sessionType = typeSelect.value as StudySessionType;
        const rawCount = Number(countInput.value);
        const rawCorrect = Number(correctInput.value);

        if (sessionType === StudySessionType.QUESTIONS && (!rawCount || rawCount <= 0)) {
          throw new ValidationError("Informe uma quantidade de questões maior que zero.");
        }

        await this.registerStudySessionUseCase.execute({
          id: createId("session"),
          contestId: activity.contestId,
          subjectId: activity.subjectId,
          studyItemId: activity.itemId,
          type: sessionType,
          studiedAt: dateInput.value,
          pagesOrCount: sessionType === StudySessionType.QUESTIONS ? rawCount : rawCount || undefined,
          correctAnswers:
            sessionType === StudySessionType.QUESTIONS ? Math.min(rawCorrect, rawCount) : undefined,
          completed: true
        });
        this.isRegisteringNextActivity = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não consegui salvar esse registro.");
      }
    });

    const context = DomHelpers.createElement("div", "leif-stack");
    context.append(
      DomHelpers.createKeyValueRow("Matéria", activity.subjectName),
      DomHelpers.createKeyValueRow("Item", activity.itemName ?? "Sem item definido")
    );

    const fields = DomHelpers.createElement("div", "leif-grid leif-grid-2");
    fields.append(
      DomHelpers.createLabel("Tipo", typeSelect),
      DomHelpers.createLabel("Quantidade", countInput),
      correctLabel,
      DomHelpers.createLabel("Data", dateInput)
    );

    const actions = DomHelpers.createElement("div", "leif-form-actions");
    actions.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isRegisteringNextActivity = false;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Registrar", {
        className: "mod-cta",
        onClick: () => form.requestSubmit()
      })
    );

    form.append(context, fields, actions);
    return form;
  }

  private getDefaultDateValue(): string {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - timezoneOffset);
    return localDate.toISOString().split("T")[0];
  }
}
