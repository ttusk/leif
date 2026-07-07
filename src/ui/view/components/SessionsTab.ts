import { Notice } from "obsidian";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { AdvanceCycleUseCase } from "@/application/use-cases/AdvanceCycleUseCase";
import { DeleteStudySessionUseCase } from "@/application/use-cases/DeleteStudySessionUseCase";
import { GetActiveContestSummaryUseCase } from "@/application/use-cases/GetActiveContestSummaryUseCase";
import { GetActiveCycleSnapshotUseCase } from "@/application/use-cases/GetActiveCycleSnapshotUseCase";
import { ListSubjectsForActiveContestUseCase } from "@/application/use-cases/ListSubjectsForActiveContestUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { UpdateStudySessionUseCase } from "@/application/use-cases/UpdateStudySessionUseCase";
import { StudySessionType } from "@/domain/entities/StudySession";
import type { StudySession } from "@/domain/entities/StudySession";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { createId } from "@/application/Id";

/**
 * Sessions tab component with unified CRUD pattern.
 */
export class SessionsTab {
  private readonly registerStudySessionUseCase: RegisterStudySessionUseCase;
  private readonly deleteStudySessionUseCase: DeleteStudySessionUseCase;
  private readonly getActiveContestSummaryUseCase: GetActiveContestSummaryUseCase;
  private readonly listSubjectsForActiveContestUseCase: ListSubjectsForActiveContestUseCase;
  private readonly updateStudySessionUseCase: UpdateStudySessionUseCase;
  private readonly advanceCycleUseCase: AdvanceCycleUseCase;
  private readonly getActiveCycleSnapshotUseCase: GetActiveCycleSnapshotUseCase;

  private editingSessionId: string | null = null;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.registerStudySessionUseCase = new RegisterStudySessionUseCase(dataStore, repositoryFactory);
    this.deleteStudySessionUseCase = new DeleteStudySessionUseCase(dataStore, repositoryFactory);
    this.getActiveContestSummaryUseCase = new GetActiveContestSummaryUseCase(dataStore);
    this.listSubjectsForActiveContestUseCase = new ListSubjectsForActiveContestUseCase(dataStore);
    this.updateStudySessionUseCase = new UpdateStudySessionUseCase(dataStore, repositoryFactory);
    this.advanceCycleUseCase = new AdvanceCycleUseCase(dataStore);
    this.getActiveCycleSnapshotUseCase = new GetActiveCycleSnapshotUseCase(dataStore);
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Sessões"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Nova sessão", {
        onClick: () => this.openCreateSessionModal(data)
      })
    );
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph("Registre sessões e gerencie o ciclo de estudos.")
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

    // Cycle context
    const snapshot = await this.getActiveCycleSnapshotUseCase.execute();
    const itemMap = new Map(data.studyItems.map((item) => [item.id, item.title]));
    const recommendedSubject = snapshot.currentSubject ?? snapshot.nextSubject;
    const afterRecommendedSubject =
      snapshot.currentSubject && snapshot.nextSubject?.id !== snapshot.currentSubject.id
        ? snapshot.nextSubject
        : null;
    const recommendedItemId = snapshot.currentItemId ?? snapshot.nextItemId;
    const cycleContext = DomHelpers.createElement("div", "leif-cycle-context");
    const nowLabel = DomHelpers.createElement("span", "leif-cycle-context-label");
    nowLabel.textContent = "Matéria recomendada: ";
    const nowValue = DomHelpers.createElement("span", "leif-cycle-context-value");
    nowValue.textContent = recommendedSubject?.name ?? "—";
    cycleContext.appendChild(nowLabel);
    cycleContext.appendChild(nowValue);
    if (recommendedItemId) {
      const itemLabel = DomHelpers.createElement("span", "leif-cycle-context-sublabel");
      itemLabel.textContent = `Item: ${itemMap.get(recommendedItemId) ?? recommendedItemId}`;
      cycleContext.appendChild(itemLabel);
    }
    if (afterRecommendedSubject) {
      const nextInfo = DomHelpers.createElement("span", "leif-cycle-context-next");
      nextInfo.textContent = `Depois: ${afterRecommendedSubject.name}`;
      cycleContext.appendChild(nextInfo);
    }
    container.appendChild(cycleContext);

    // Cycle action button
    const cycleAction = DomHelpers.createElement("div", "leif-cycle-action");
    cycleAction.appendChild(
      DomHelpers.createButton("Finalizar ciclo atual", {
        className: "leif-primary-button",
        icon: "refresh-cw",
        onClick: async () => {
          try {
            const result = await this.advanceCycleUseCase.execute();
            new Notice(`Ciclo finalizado! Matéria recomendada: ${result.currentSubject?.name ?? "—"}`);
            await this.onUpdate();
          } catch (error) {
            DomHelpers.notifyError(error, "Não foi possível finalizar o ciclo.");
          }
        }
      })
    );
    container.appendChild(cycleAction);

    const subjects = data.subjects.filter((subject) => subject.contestId === activeContest.id);

    const recentSessions = DomHelpers.createCard("Histórico recente");
    const sessions = data.studySessions
      .filter((session) => session.contestId === activeContest.id)
      .slice()
      .reverse()
      .slice(0, 10);

    if (sessions.length === 0) {
      recentSessions.appendChild(DomHelpers.createParagraph("Nenhuma sessão registrada."));
    } else {
      const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
        "Data",
        "Matéria",
        "Assunto",
        "Tipo",
        "Progresso",
        "Acertos",
        "Ações"
      ]);

      sessions.forEach((session) => {
        const isEditing = this.editingSessionId === session.id;
        if (isEditing) {
          tbody.appendChild(this.renderEditableRow(session, data));
        } else {
          tbody.appendChild(this.renderDisplayRow(session, data));
        }
      });

      recentSessions.appendChild(tableContainer);
    }

    container.appendChild(recentSessions);
  }

  private renderDisplayRow(session: StudySession, data: LeifPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.sessionId = session.id;
    const subjectName =
      data.subjects.find((subject) => subject.id === session.subjectId)?.name ?? "—";
    const topicName =
      data.topics.find((topic) => topic.id === session.topicId)?.name ?? "—";

    tr.appendChild(DomHelpers.createCell(new Date(session.studiedAt).toLocaleDateString("pt-BR")));
    tr.appendChild(DomHelpers.createCell(subjectName));
    tr.appendChild(DomHelpers.createCell(topicName));
    tr.appendChild(DomHelpers.createCell(this.formatSessionType(session.type)));
    tr.appendChild(
      DomHelpers.createCell(
        null,
        this.renderSessionProgress(session, data)
      )
    );
    tr.appendChild(
      DomHelpers.createCell(
        session.type === StudySessionType.QUESTIONS ? String(session.correctAnswers ?? 0) : "—"
      )
    );

    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingSessionId = session.id;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("delete", "Excluir", {
        dataset: { sessionDeleteId: session.id },
        onClick: async () => {
          const confirmed = await DomHelpers.confirm({
            title: "Excluir sessão",
            message: "Excluir esta sessão?",
            confirmLabel: "Excluir"
          });
          if (!confirmed) return;
          try {
            await this.deleteStudySessionUseCase.execute({ sessionId: session.id });
            await this.onUpdate();
          } catch (error) {
            DomHelpers.notifyError(error, "Não foi possível excluir a sessão.");
          }
        }
      })
    );

    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);

    return tr;
  }

  private renderSessionProgress(session: StudySession, data: LeifPluginData): HTMLElement {
    const container = DomHelpers.createElement("div", "leif-session-progress");

    if (session.type === StudySessionType.PDF && session.studyItemId) {
      const item = data.studyItems.find((i) => i.id === session.studyItemId);
      const total = item?.totalPages;
      const readed = session.pagesOrCount ?? 0;

      if (total !== undefined && total > 0) {
        const progressBar = DomHelpers.createProgressBar(readed, total);
        container.appendChild(progressBar);
        return container;
      }
    }

    container.textContent = String(session.pagesOrCount ?? 0);
    return container;
  }

  private renderEditableRow(session: StudySession, data: LeifPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-editing-row";
    tr.dataset.sessionId = session.id;

    const countInput = DomHelpers.createCompactInput("number", "Qtd", String(session.pagesOrCount ?? 0));
    const correctInput = DomHelpers.createCompactInput("number", "Acertos", String(session.correctAnswers ?? 0));

    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateStudySessionUseCase.execute({
            sessionId: session.id,
            pagesOrCount: Number(countInput.value),
            correctAnswers: session.type === StudySessionType.QUESTIONS ? Number(correctInput.value) : undefined
          });
          this.editingSessionId = null;
          await this.onUpdate();
        } catch (error) {
          DomHelpers.notifyError(error, "Não foi possível salvar.");
        }
      }
    });

    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingSessionId = null;
        await this.onUpdate();
      }
    });

    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);

    const subjectName =
      data.subjects.find((subject) => subject.id === session.subjectId)?.name ?? "—";
    const topicName =
      data.topics.find((topic) => topic.id === session.topicId)?.name ?? "—";

    tr.appendChild(DomHelpers.createCell(new Date(session.studiedAt).toLocaleDateString("pt-BR")));
    tr.appendChild(DomHelpers.createCell(subjectName));
    tr.appendChild(DomHelpers.createCell(topicName));
    tr.appendChild(DomHelpers.createCell(this.formatSessionType(session.type)));
    tr.appendChild(DomHelpers.createCell(null, countInput));
    tr.appendChild(
      DomHelpers.createCell(
        session.type === StudySessionType.QUESTIONS ? null : "—",
        session.type === StudySessionType.QUESTIONS ? correctInput : undefined
      )
    );

    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);

    return tr;
  }

  private openCreateSessionModal(data: LeifPluginData): void {
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);
    if (!activeContest) return;

    const subjects = data.subjects.filter((subject) => subject.contestId === activeContest.id);

    const form = DomHelpers.createForm(async () => {
      try {
        const sessionType = typeSelect.value as StudySessionType;
        const rawCount = Number(countInput.value);
        const rawCorrect = Number(correctInput.value);

        const pagesOrCount = sessionType === StudySessionType.QUESTIONS ? rawCount : rawCount || undefined;
        const correctAnswers =
          sessionType === StudySessionType.QUESTIONS ? Math.min(rawCorrect, rawCount) : undefined;

        await this.registerStudySessionUseCase.execute({
          id: createId("session"),
          contestId: activeContest.id,
          subjectId: subjectSelect.value,
          studyItemId: itemSelect.value || undefined,
          topicId: topicSelect.value || undefined,
          type: sessionType,
          studiedAt: dateInput.value,
          pagesOrCount,
          correctAnswers,
          completed: true
        });
        modal.close();
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não foi possível registrar a sessão.");
      }
    });

    const subjectSelect = DomHelpers.createSelect(
      subjects.map((subject) => [subject.id, subject.name])
    );
    const typeSelect = DomHelpers.createSelect([
      ["pdf", "PDF"],
      ["video", "Vídeo"],
      ["questions", "Questões"]
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
      const previousItem = itemSelect.value;
      const previousTopic = topicSelect.value;

      DomHelpers.replaceSelectOptions(itemSelect, getItemOptions());
      DomHelpers.replaceSelectOptions(topicSelect, getTopicOptions());

      const itemStillValid = Array.from(itemSelect.options).some(
        (option) => option.value === previousItem
      );
      const topicStillValid = Array.from(topicSelect.options).some(
        (option) => option.value === previousTopic
      );

      if (!itemStillValid) {
        itemSelect.value = "";
      }
      if (!topicStillValid) {
        topicSelect.value = "";
      }
    };

    const syncQuestionField = (): void => {
      const isQuestionSession = typeSelect.value === StudySessionType.QUESTIONS;
      correctLabel.style.display = isQuestionSession ? "" : "none";
    };

    subjectSelect.addEventListener("change", syncDependentSelects);
    typeSelect.addEventListener("change", syncQuestionField);
    syncDependentSelects();
    syncQuestionField();

    const formGrid = DomHelpers.createElement("div", "leif-form-grid");
    formGrid.append(
      DomHelpers.createLabel("Matéria", subjectSelect),
      DomHelpers.createLabel("Tipo", typeSelect),
      DomHelpers.createLabel("Item", itemSelect),
      DomHelpers.createLabel("Assunto", topicSelect),
      DomHelpers.createLabel("Quantidade", countInput),
      correctLabel,
      DomHelpers.createLabel("Data", dateInput)
    );
    form.appendChild(formGrid);

    const modal = DomHelpers.createModal({
      title: "Nova sessão",
      content: form,
      onSubmit: () => form.requestSubmit()
    });

    modal.open();
  }

  private formatSessionType(type: StudySessionType): string {
    if (type === StudySessionType.QUESTIONS) return "Questões";
    if (type === StudySessionType.VIDEO) return "Vídeo";
    return "PDF";
  }

  private getDefaultDateValue(): string {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - timezoneOffset);
    return localDate.toISOString().split("T")[0];
  }
}
