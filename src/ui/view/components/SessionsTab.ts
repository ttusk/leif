import { Notice } from "obsidian";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { DeleteStudySessionUseCase } from "@/application/use-cases/DeleteStudySessionUseCase";
import { GetActiveContestSummaryUseCase } from "@/application/use-cases/GetActiveContestSummaryUseCase";
import { ListSubjectsForActiveContestUseCase } from "@/application/use-cases/ListSubjectsForActiveContestUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import type { CorvoPluginData } from "@/domain/types/CorvoPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";

/**
 * Sessions tab component - shows session registration form and recent history.
 */
export class SessionsTab {
  private readonly registerStudySessionUseCase: RegisterStudySessionUseCase;
  private readonly deleteStudySessionUseCase: DeleteStudySessionUseCase;
  private readonly getActiveContestSummaryUseCase: GetActiveContestSummaryUseCase;
  private readonly listSubjectsForActiveContestUseCase: ListSubjectsForActiveContestUseCase;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    this.registerStudySessionUseCase = new RegisterStudySessionUseCase(dataStore);
    this.deleteStudySessionUseCase = new DeleteStudySessionUseCase(dataStore);
    this.getActiveContestSummaryUseCase = new GetActiveContestSummaryUseCase(dataStore);
    this.listSubjectsForActiveContestUseCase = new ListSubjectsForActiveContestUseCase(dataStore);
  }

  /**
   * Renders the sessions tab content.
   */
  async render(container: HTMLElement, data: CorvoPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Sessões"));
    container.appendChild(
      DomHelpers.createParagraph("Registre sessões manualmente e acompanhe o histórico recente.")
    );

    const activeContest =
      data.contests.find((contest) => contest.id === data.activeContestId) ?? null;

    if (!activeContest) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Nenhum concurso ativo",
          "Selecione um concurso para registrar sessões."
        )
      );
      return;
    }

    const subjects = data.subjects.filter((subject) => subject.contestId === activeContest.id);

    const form = DomHelpers.createForm(async () => {
      try {
        await this.registerStudySessionUseCase.execute({
          id: `session-${Date.now()}`,
          contestId: activeContest.id,
          subjectId: subjectSelect.value,
          studyItemId: itemSelect.value || undefined,
          topicId: topicSelect.value || undefined,
          type: typeSelect.value as "pdf" | "video" | "questions",
          studiedAt: dateInput.value,
          pagesOrCount: Number(countInput.value),
          correctAnswers:
            typeSelect.value === "questions" ? Number(correctInput.value) : undefined,
          completed: true
        });
        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "Não foi possível registrar a sessão.");
      }
    });
    form.classList.add("corvo-card", "corvo-form-sheet");

    const subjectSelect = DomHelpers.createSelect(
      subjects.map((subject) => [subject.id, subject.name])
    );
    const typeSelect = DomHelpers.createSelect([
      ["pdf", "pdf"],
      ["video", "video"],
      ["questions", "questions"]
    ]);

    const getItemOptions = (): Array<[string, string]> => [
      ["", "Sem item"],
      ...data.studyItems
        .filter((studyItem) => studyItem.subjectId === subjectSelect.value)
        .map((studyItem): [string, string] => [studyItem.id, studyItem.title])
    ];

    const getTopicOptions = (): Array<[string, string]> => [
      ["", "Sem assunto"],
      ...data.topics
        .filter((topic) => topic.subjectId === subjectSelect.value)
        .map((topic): [string, string] => [topic.id, topic.name])
    ];

    const itemSelect = DomHelpers.createSelect(getItemOptions());
    const topicSelect = DomHelpers.createSelect(getTopicOptions());
    const countInput = DomHelpers.createInput("number", "Páginas ou quantidade", "0");
    const correctInput = DomHelpers.createInput("number", "Acertos", "0");
    const correctLabel = DomHelpers.createLabel("Acertos", correctInput);
    const dateInput = DomHelpers.createInput("date", "Data");
    dateInput.value = this.getDefaultDateValue();

    const syncDependentSelects = (): void => {
      DomHelpers.replaceSelectOptions(itemSelect, getItemOptions());
      DomHelpers.replaceSelectOptions(topicSelect, getTopicOptions());
    };

    const syncQuestionField = (): void => {
      const isQuestionSession = typeSelect.value === "questions";
      correctLabel.style.display = isQuestionSession ? "" : "none";
    };

    subjectSelect.addEventListener("change", syncDependentSelects);
    typeSelect.addEventListener("change", syncQuestionField);
    syncDependentSelects();
    syncQuestionField();

    const formGrid = DomHelpers.createElement("div", "corvo-form-grid");
    formGrid.append(
      DomHelpers.createLabel("Matéria", subjectSelect),
      DomHelpers.createLabel("Tipo", typeSelect),
      DomHelpers.createLabel("Item", itemSelect),
      DomHelpers.createLabel("Assunto", topicSelect),
      DomHelpers.createLabel("Quantidade", countInput),
      correctLabel,
      DomHelpers.createLabel("Data", dateInput)
    );
    form.append(
      formGrid,
      DomHelpers.createButton("Registrar sessão", {
        type: "submit",
        className: "corvo-primary-button"
      })
    );

    const recentSessions = DomHelpers.createCard("Histórico recente");
    const sessionRows = data.studySessions
      .filter((session) => session.contestId === activeContest.id)
      .slice()
      .reverse()
      .slice(0, 8)
      .map((session) => {
        const subjectName =
          data.subjects.find((subject) => subject.id === session.subjectId)?.name ??
          "sem matéria";
        const topicName =
          data.topics.find((topic) => topic.id === session.topicId)?.name ?? "-";
        const deleteButton = DomHelpers.createIconButton("delete", "Excluir", {
          dataset: { sessionDeleteId: session.id },
          onClick: async () => {
            try {
              await this.deleteStudySessionUseCase.execute({ sessionId: session.id });
              await this.onUpdate();
            } catch (error) {
              this.notifyError(error, "Não foi possível excluir a sessão.");
            }
          }
        });
        return [
          new Date(session.studiedAt).toLocaleDateString("pt-BR"),
          subjectName,
          topicName,
          this.formatSessionType(session.type),
          String(session.pagesOrCount ?? 0),
          deleteButton
        ];
      });

    recentSessions.appendChild(
      DomHelpers.createTable(
        ["Data", "Matéria", "Assunto", "Tipo", "Progresso", "Ações"],
        sessionRows
      )
    );

    container.append(form, recentSessions);
  }

  /**
   * Formats a session type for display.
   */
  private formatSessionType(type: "pdf" | "video" | "questions"): string {
    if (type === "questions") {
      return "Questões";
    }
    if (type === "video") {
      return "Vídeo";
    }
    return "PDF";
  }

  /**
   * Returns the default date value for the date input (YYYY-MM-DD).
   */
  private getDefaultDateValue(): string {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - timezoneOffset);
    return localDate.toISOString().split("T")[0];
  }

  /**
   * Displays an error notification.
   */
  private notifyError(error: unknown, fallbackMessage: string): void {
    new Notice(error instanceof Error ? error.message : fallbackMessage);
  }
}
