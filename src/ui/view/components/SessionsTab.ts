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
  private isCreatingSession = false;
  private pendingDeleteSessionId: string | null = null;
  private historySubjectFilter = "";
  private historyTypeFilter = "";
  private historyFromFilter = "";
  private historyToFilter = "";

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
    header.appendChild(DomHelpers.createSectionTitle("Registros"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Nova sessão", {
        onClick: async () => {
          this.isCreatingSession = true;
          await this.onUpdate();
        }
      })
    );
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph("Anote o que você estudou. O Leif cuida do resto.")
    );

    const activeContest =
      data.contests.find((contest) => contest.id === data.activeContestId) ?? null;

    if (!activeContest) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Sem concurso escolhido",
          "Escolha um concurso antes de registrar estudos."
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
    nowLabel.textContent = "Agora: ";
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
      nextInfo.textContent = `Depois vem ${afterRecommendedSubject.name}`;
      cycleContext.appendChild(nextInfo);
    }
    container.appendChild(cycleContext);

    // Cycle action button
    const cycleAction = DomHelpers.createElement("div", "leif-cycle-action");
    cycleAction.appendChild(
      DomHelpers.createButton("Marcar como estudado", {
        className: "mod-cta",
        icon: "refresh-cw",
        onClick: async () => {
          try {
            const result = await this.advanceCycleUseCase.execute();
            new Notice(`Pronto. Agora vem ${result.currentSubject?.name ?? "—"}.`);
            await this.onUpdate();
          } catch (error) {
            DomHelpers.notifyError(error, "Não consegui avançar o plano.");
          }
        }
      })
    );
    container.appendChild(cycleAction);

    if (this.isCreatingSession) {
      container.appendChild(this.renderCreateSessionForm(data));
    }

    const subjects = data.subjects.filter((subject) => subject.contestId === activeContest.id);

    const recentSessions = DomHelpers.createCard("Histórico de sessões");
    const allSessions = data.studySessions
      .filter((session) => session.contestId === activeContest.id)
      .slice()
      .reverse();
    const sessions = this.filterSessions(allSessions);

    if (allSessions.length > 0) {
      recentSessions.appendChild(this.renderHistoryFilters(subjects));
    }

    if (sessions.length === 0) {
      recentSessions.appendChild(
        DomHelpers.createParagraph(
          allSessions.length === 0
            ? "Nenhuma sessão registrada."
            : "Nenhuma sessão encontrada com esses filtros."
        )
      );
    } else {
      const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
        "Data",
        "Estudo",
        "Tipo",
        "Resultado",
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

  private renderHistoryFilters(subjects: LeifPluginData["subjects"]): HTMLElement {
    const subjectSelect = DomHelpers.createSelect(
      [
        ["", "Todas"],
        ...subjects.map((subject): [string, string] => [subject.id, subject.name])
      ],
      this.historySubjectFilter
    );
    const typeSelect = DomHelpers.createSelect(
      [
        ["", "Todos"],
        [StudySessionType.PDF, "PDF"],
        [StudySessionType.VIDEO, "Vídeo"],
        [StudySessionType.QUESTIONS, "Questões"]
      ],
      this.historyTypeFilter
    );
    const fromInput = DomHelpers.createInput("date", "De", this.historyFromFilter);
    const toInput = DomHelpers.createInput("date", "Até", this.historyToFilter);

    subjectSelect.dataset.sessionFilter = "subject";
    typeSelect.dataset.sessionFilter = "type";
    fromInput.dataset.sessionFilter = "from";
    toInput.dataset.sessionFilter = "to";

    subjectSelect.addEventListener("change", async () => {
      this.historySubjectFilter = subjectSelect.value;
      await this.onUpdate();
    });
    typeSelect.addEventListener("change", async () => {
      this.historyTypeFilter = typeSelect.value;
      await this.onUpdate();
    });
    fromInput.addEventListener("change", async () => {
      this.historyFromFilter = fromInput.value;
      await this.onUpdate();
    });
    toInput.addEventListener("change", async () => {
      this.historyToFilter = toInput.value;
      await this.onUpdate();
    });

    const filters = DomHelpers.createElement("div", "leif-session-filters");
    filters.append(
      DomHelpers.createStackedLabel("Matéria", subjectSelect),
      DomHelpers.createStackedLabel("Tipo", typeSelect),
      DomHelpers.createStackedLabel("De", fromInput),
      DomHelpers.createStackedLabel("Até", toInput)
    );

    return filters;
  }

  private filterSessions(sessions: StudySession[]): StudySession[] {
    return sessions.filter((session) => {
      if (this.historySubjectFilter && session.subjectId !== this.historySubjectFilter) {
        return false;
      }
      if (this.historyTypeFilter && session.type !== this.historyTypeFilter) {
        return false;
      }

      const sessionDate = session.studiedAt.slice(0, 10);
      if (this.historyFromFilter && sessionDate < this.historyFromFilter) {
        return false;
      }
      if (this.historyToFilter && sessionDate > this.historyToFilter) {
        return false;
      }

      return true;
    });
  }

  private renderDisplayRow(session: StudySession, data: LeifPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.sessionId = session.id;
    const subjectName =
      data.subjects.find((subject) => subject.id === session.subjectId)?.name ?? "—";
    const topicName =
      data.topics.find((topic) => topic.id === session.topicId)?.name ?? "—";

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
          this.pendingDeleteSessionId = session.id;
          await this.onUpdate();
        }
      })
    );

    if (this.pendingDeleteSessionId === session.id) {
      actions.append(
        DomHelpers.createButton("Excluir?", {
          dataset: { sessionConfirmDeleteId: session.id },
          onClick: async () => {
            try {
              await this.deleteStudySessionUseCase.execute({ sessionId: session.id });
              this.pendingDeleteSessionId = null;
              await this.onUpdate();
            } catch (error) {
              DomHelpers.notifyError(error, "Não consegui excluir esse registro.");
            }
          }
        }),
        DomHelpers.createButton("Cancelar", {
          onClick: async () => {
            this.pendingDeleteSessionId = null;
            await this.onUpdate();
          }
        })
      );
    }

    tr.appendChild(DomHelpers.createCell(null, DomHelpers.createMetric("Data", new Date(session.studiedAt).toLocaleDateString("pt-BR"))));
    tr.appendChild(DomHelpers.createCell(null, DomHelpers.createMetric("Estudo", this.formatStudyLabel(subjectName, topicName))));
    tr.appendChild(DomHelpers.createCell(null, DomHelpers.createMetric("Tipo", this.formatSessionType(session.type))));
    tr.appendChild(DomHelpers.createCell(null, DomHelpers.createMetric("Resultado", this.renderSessionResult(session, data))));
    const actionsCell = DomHelpers.createCell(null, actions);
    actionsCell.classList.add("leif-actions-cell");
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

    const countLabel = session.type === StudySessionType.QUESTIONS ? "Questões resolvidas" : "Páginas/quantidade";
    const countInput = DomHelpers.createCompactInput("number", countLabel, String(session.pagesOrCount ?? 0));
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
          DomHelpers.notifyError(error, "Não consegui salvar.");
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
    const resultFields = DomHelpers.createElement("div", "leif-session-result-editor");
    resultFields.append(DomHelpers.createStackedLabel(countLabel, countInput));
    if (session.type === StudySessionType.QUESTIONS) {
      resultFields.append(DomHelpers.createStackedLabel("Acertos", correctInput));
    }

    tr.appendChild(DomHelpers.createCell(new Date(session.studiedAt).toLocaleDateString("pt-BR")));
    tr.appendChild(DomHelpers.createCell(this.formatStudyLabel(subjectName, topicName)));
    tr.appendChild(DomHelpers.createCell(this.formatSessionType(session.type)));
    tr.appendChild(DomHelpers.createCell(null, resultFields));
    const actionsCell = DomHelpers.createCell(null, actions);
    actionsCell.classList.add("leif-actions-cell");
    tr.appendChild(actionsCell);

    return tr;
  }

  private renderCreateSessionForm(data: LeifPluginData): HTMLElement {
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);
    if (!activeContest) return DomHelpers.createEmptyState("Sem concurso escolhido", "Escolha um concurso antes de registrar.");

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
        this.isCreatingSession = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não consegui salvar esse registro.");
      }
    });

    const subjectSelect = DomHelpers.createSelect(
      subjects.map((subject) => [subject.id, subject.name])
    );
    const typeSelect = DomHelpers.createSelect([
      ["pdf", "PDF"],
      ["video", "Vídeo"],
      [StudySessionType.QUESTIONS, "Questões"]
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

    const formGrid = DomHelpers.createElement("div", "leif-grid leif-grid-2");
    formGrid.append(
      DomHelpers.createLabel("Matéria", subjectSelect),
      DomHelpers.createLabel("Tipo", typeSelect),
      DomHelpers.createLabel("Item", itemSelect),
      DomHelpers.createLabel("Assunto", topicSelect),
      DomHelpers.createLabel("Quantidade", countInput),
      correctLabel,
      DomHelpers.createLabel("Data", dateInput)
    );
    form.classList.add("leif-card");
    form.append(
      DomHelpers.createSectionSubtitle("Novo registro"),
      formGrid,
      DomHelpers.createElement("div", "leif-form-actions")
    );

    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isCreatingSession = false;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Registrar", {
        type: "submit",
        className: "mod-cta"
      })
    );

    return form;
  }

  private formatSessionType(type: StudySessionType): string {
    if (type === StudySessionType.QUESTIONS) return "Questões";
    if (type === StudySessionType.VIDEO) return "Vídeo";
    return "PDF";
  }

  private formatStudyLabel(subjectName: string, topicName: string): string {
    return topicName === "—" ? subjectName : `${subjectName} · ${topicName}`;
  }

  private renderSessionResult(session: StudySession, data: LeifPluginData): HTMLElement {
    if (session.type === StudySessionType.QUESTIONS) {
      const result = DomHelpers.createElement("span");
      result.textContent = `${session.correctAnswers ?? 0}/${session.pagesOrCount ?? 0} acertos`;
      return result;
    }

    return this.renderSessionProgress(session, data);
  }

  private getDefaultDateValue(): string {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - timezoneOffset);
    return localDate.toISOString().split("T")[0];
  }
}
