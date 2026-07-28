import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { AdvanceCycleUseCase } from "@/application/use-cases/AdvanceCycleUseCase";
import { DeleteStudySessionUseCase } from "@/application/use-cases/DeleteStudySessionUseCase";
import {
  type RegisterStudyRecordInput,
  RegisterStudySessionUseCase
} from "@/application/use-cases/RegisterStudySessionUseCase";
import { UpdateStudySessionUseCase } from "@/application/use-cases/UpdateStudySessionUseCase";
import { RestoreCyclePositionUseCase } from "@/application/use-cases/RestoreCyclePositionUseCase";
import { createLeifId } from "@/application/Id";
import type { CyclePosition } from "@/domain/entities/CycleState";
import type { StudyRecord } from "@/domain/entities/StudyRecord";
import type { StudySession } from "@/domain/entities/StudySession";
import { GoalUnit, isGoalUnit } from "@/domain/types/GoalUnit";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { ConfirmationModal } from "@/ui/confirmation/ConfirmationModal";
import { CycleRecommendationPanel } from "@/ui/view/shared/CycleRecommendationPanel";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { formatGoalQuantity, goalUnitOptions } from "@/ui/view/shared/StudyLabels";
import type { RecommendedStudyRegistration } from "@/ui/view/components/DashboardTab";
import type { App } from "obsidian";

interface SessionFilters {
  subjectId: string;
  fromDate: string;
  toDate: string;
}

interface CycleUndoState {
  contestId: string;
  expectedCurrent: CyclePosition;
  restoreTo: CyclePosition;
}

export class SessionsTab {
  private readonly registerSession: RegisterStudySessionUseCase;
  private readonly advanceCycle: AdvanceCycleUseCase;
  private readonly updateSession: UpdateStudySessionUseCase;
  private readonly restoreCyclePosition: RestoreCyclePositionUseCase;
  private readonly deleteSession: DeleteStudySessionUseCase;
  private readonly recommendation: CycleRecommendationPanel;
  private readonly filters: SessionFilters = {
    subjectId: "",
    fromDate: "",
    toDate: ""
  };
  private cycleUndo: CycleUndoState | null = null;
  private sessionEditorError: string | null = null;
  private editingSessionId: string | null = null;
  private addingRecordToSessionId: string | null = null;
  private recommendedRegistration: RecommendedStudyRegistration | null = null;

  constructor(
    private readonly app: App,
    dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    this.registerSession = new RegisterStudySessionUseCase(dataStore);
    this.advanceCycle = new AdvanceCycleUseCase(dataStore);
    this.updateSession = new UpdateStudySessionUseCase(dataStore);
    this.restoreCyclePosition = new RestoreCyclePositionUseCase(dataStore);
    this.deleteSession = new DeleteStudySessionUseCase(dataStore);
    this.recommendation = new CycleRecommendationPanel(dataStore);
  }

  startRecommendedStudy(registration: RecommendedStudyRegistration): void {
    this.recommendedRegistration = registration;
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Registros"));
    const contestId = data.activeContestId;
    if (!contestId) {
      container.appendChild(
        DomHelpers.createEmptyState("Sem concurso ativo", "Escolha um concurso antes de registrar.")
      );
      return;
    }
    container.appendChild(
      await this.recommendation.render({
        label: "Avançar para próxima matéria",
        onClick: async (snapshot) => {
          const result = await this.advanceCycle.execute();
          this.cycleUndo = {
            contestId: snapshot.contestId,
            expectedCurrent: result.current,
            restoreTo: result.previous
          };
          await this.onUpdate();
        }
      })
    );
    if (this.cycleUndo) {
      container.appendChild(this.renderCycleUndoFeedback());
    }
    container.appendChild(this.renderCreateForm(data, contestId));
    container.appendChild(this.renderSessionHistory(data, contestId));
  }

  private renderCycleUndoFeedback(): HTMLElement {
    const feedback = DomHelpers.createElement("div", "leif-session-feedback");
    feedback.setAttribute("role", "status");
    feedback.append(
      DomHelpers.createParagraph("Ciclo avançado."),
      DomHelpers.createButton("Desfazer avanço do ciclo", {
        dataset: { sessionCycleUndo: "true" },
        onClick: async () => {
          if (!this.cycleUndo) return;
          await this.restoreCyclePosition.execute(this.cycleUndo);
          this.cycleUndo = null;
          await this.onUpdate();
        }
      })
    );
    return feedback;
  }

  private renderSessionHistory(data: LeifPluginData, contestId: string): HTMLElement {
    const history = DomHelpers.createElement("section", "leif-session-history");
    history.appendChild(DomHelpers.createSectionSubtitle("Histórico"));
    const sessions = data.studySessions
      .filter((session) => session.contestId === contestId)
      .sort((left, right) => this.compareSessionsByDateTime(left, right));
    history.appendChild(this.renderSessionFilters(data, contestId));

    if (sessions.length === 0) {
      history.appendChild(
        DomHelpers.createEmptyState("Sem registros", "As sessões registradas aparecerão aqui.")
      );
      return history;
    }

    const filteredSessions = sessions
      .map((session) => ({
        session,
        records: this.filteredRecordsForSession(session)
      }))
      .filter(
        ({ session, records }) => this.sessionMatchesDateRange(session) && records.length > 0
      );

    if (filteredSessions.length === 0) {
      history.appendChild(
        DomHelpers.createEmptyState(
          "Nenhum registro encontrado",
          "Ajuste os filtros para ver mais sessões."
        )
      );
      return history;
    }

    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Data",
      "Matéria",
      "Recurso",
      "Assunto",
      "Resultado",
      "Ações"
    ]);
    tableContainer.querySelector("table")?.classList.add("leif-session-table");
    filteredSessions.forEach(({ session, records }) => {
      this.renderSessionRows(data, session, records).forEach((row) => tbody.appendChild(row));
    });
    history.appendChild(tableContainer);
    filteredSessions.forEach(({ session }) => {
      if (this.editingSessionId === session.id || this.addingRecordToSessionId === session.id) {
        history.appendChild(
          this.renderSessionEditor(data, session, this.addingRecordToSessionId === session.id)
        );
      }
    });
    return history;
  }

  private renderSessionFilters(data: LeifPluginData, contestId: string): HTMLElement {
    const filters = DomHelpers.createElement("div", "leif-session-filters");
    const subject = DomHelpers.createSelect(
      [
        ["", "Todas as matérias"],
        ...data.subjects
          .filter((entry) => entry.contestId === contestId)
          .sort((left, right) => left.order - right.order)
          .map((entry): [string, string] => [entry.id, entry.name])
      ],
      this.filters.subjectId
    );
    subject.dataset.sessionFilterSubject = "true";
    const from = DomHelpers.createInput("date", "De", this.filters.fromDate);
    from.dataset.sessionFilterFrom = "true";
    const to = DomHelpers.createInput("date", "Até", this.filters.toDate);
    to.dataset.sessionFilterTo = "true";

    subject.addEventListener("change", () => {
      this.filters.subjectId = subject.value;
      void this.onUpdate();
    });
    from.addEventListener("change", () => {
      this.filters.fromDate = from.value;
      void this.onUpdate();
    });
    to.addEventListener("change", () => {
      this.filters.toDate = to.value;
      void this.onUpdate();
    });

    filters.append(
      DomHelpers.createStackedLabel("Matéria", subject),
      DomHelpers.createStackedLabel("De", from),
      DomHelpers.createStackedLabel("Até", to)
    );
    return filters;
  }

  private filteredRecordsForSession(session: StudySession): StudyRecord[] {
    return session.records.filter((record) => {
      if (this.filters.subjectId && record.subjectId !== this.filters.subjectId) return false;
      return true;
    });
  }

  private sessionMatchesDateRange(session: StudySession): boolean {
    if (this.filters.fromDate && session.date < this.filters.fromDate) return false;
    if (this.filters.toDate && session.date > this.filters.toDate) return false;
    return true;
  }

  private renderSessionRows(
    data: LeifPluginData,
    session: StudySession,
    visibleRecords: StudyRecord[]
  ): HTMLTableRowElement[] {
    return visibleRecords.map((record, index) => {
      const row = DomHelpers.createElement("tr", "leif-session-record");
      row.dataset.sessionId = session.id;
      const subject = data.subjects.find((entry) => entry.id === record.subjectId);
      const resource = record.resourceId
        ? data.resources.find((entry) => entry.id === record.resourceId)
        : undefined;
      const topic = record.topicId
        ? data.topics.find((entry) => entry.id === record.topicId)
        : undefined;

      if (index === 0) {
        const dateContent = DomHelpers.createElement("div", "leif-session-date");
        dateContent.appendChild(DomHelpers.createStrong(this.formatSessionDate(session.date)));
        if (session.notes) {
          const notes = DomHelpers.createElement("span", "leif-session-note");
          notes.textContent = session.notes;
          dateContent.appendChild(notes);
        }
        const dateCell = DomHelpers.createCell(null, dateContent, "leif-table-cell-numeric");
        row.appendChild(dateCell);
      } else {
        row.appendChild(DomHelpers.createNumericCell(this.formatSessionDate(session.date)));
      }

      row.append(
        DomHelpers.createNameCell(subject?.name ?? "Matéria removida"),
        DomHelpers.createNameCell(resource?.title ?? "Sem recurso"),
        DomHelpers.createNameCell(topic?.name ?? "Sem assunto"),
        DomHelpers.createNumericCell(this.formatRecordResult(record))
      );

      if (index === 0) {
        const actionsCell = DomHelpers.createActionsCell(this.renderSessionMenu(session));
        actionsCell.setAttribute("rowspan", String(visibleRecords.length));
        row.appendChild(actionsCell);
      }
      return row;
    });
  }

  private renderSessionMenu(session: StudySession): HTMLElement {
    return DomHelpers.createMenuButton(
      [
        {
          label: "Editar sessão",
          icon: "edit",
          onClick: async () => {
            this.editingSessionId = session.id;
            this.addingRecordToSessionId = null;
            this.sessionEditorError = null;
            await this.onUpdate();
          }
        },
        {
          label: "Adicionar registro",
          icon: "plus",
          onClick: async () => {
            this.addingRecordToSessionId = session.id;
            this.editingSessionId = null;
            this.sessionEditorError = null;
            await this.onUpdate();
          }
        },
        {
          label: "Excluir sessão",
          icon: "trash-2",
          onClick: async () => {
            const date = this.formatSessionDate(session.date);
            const confirmed = await ConfirmationModal.ask(this.app, {
              title: "Excluir sessão?",
              message: `A sessão de ${date} e todos os seus registros serão excluídos.`,
              confirmLabel: "Excluir sessão"
            });
            if (!confirmed) return;
            await this.deleteSession.execute({ sessionId: session.id });
            await this.onUpdate();
          }
        }
      ],
      `Ações da sessão de ${this.formatSessionDate(session.date)}`
    );
  }

  private renderSessionEditor(
    data: LeifPluginData,
    session: StudySession,
    includeBlankRecord: boolean
  ): HTMLElement {
    const date = DomHelpers.createInput("date", "Data", session.date);
    date.dataset.sessionEditorDate = "true";
    const notes = DomHelpers.createTextarea("Notas", session.notes ?? "");
    notes.dataset.sessionEditorNotes = "true";
    const records = DomHelpers.createElement("div", "leif-session-record-editor-list");

    const saveSession = async () => {
      try {
        await this.updateSession.execute({
          sessionId: session.id,
          date: date.value,
          notes: notes.value || null,
          records: this.readRecordEditors(records)
        });
        this.sessionEditorError = null;
        this.editingSessionId = null;
        this.addingRecordToSessionId = null;
        await this.onUpdate();
      } catch (error) {
        this.sessionEditorError = `Não foi possível salvar a sessão: ${this.errorMessage(error)}`;
        await this.onUpdate();
      }
    };
    const form = DomHelpers.createForm(saveSession);
    form.className = "leif-session-editor";
    form.appendChild(DomHelpers.createSectionSubtitle("Editar sessão"));
    if (this.sessionEditorError) {
      const error = DomHelpers.createElement("div", "leif-session-editor-error");
      error.setAttribute("role", "alert");
      error.textContent = this.sessionEditorError;
      form.appendChild(error);
    }
    form.append(
      DomHelpers.createStackedLabel("Data", date),
      DomHelpers.createStackedLabel("Notas", notes)
    );

    session.records.forEach((record) => {
      records.appendChild(this.renderRecordEditor(data, record));
    });
    if (includeBlankRecord) {
      records.appendChild(this.renderRecordEditor(data));
    }
    this.refreshRecordEditorIndexes(records);
    form.appendChild(records);

    const actions = DomHelpers.createElement("div", "leif-form-actions");
    actions.append(
      DomHelpers.createButton("Adicionar registro", {
        dataset: { sessionEditorAddRecord: "true" },
        onClick: () => {
          records.appendChild(this.renderRecordEditor(data));
          this.refreshRecordEditorIndexes(records);
        }
      }),
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.editingSessionId = null;
          this.addingRecordToSessionId = null;
          this.sessionEditorError = null;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Salvar sessão", {
        onClick: saveSession,
        className: "mod-cta",
        dataset: { sessionEditorSave: "true" }
      })
    );
    form.appendChild(actions);
    return form;
  }

  private renderRecordEditor(
    data: LeifPluginData,
    record?: StudyRecord,
    defaults?: RecommendedStudyRegistration | null
  ): HTMLElement {
    const row = DomHelpers.createElement("div", "leif-session-record-editor");
    if (record) row.dataset.recordId = record.id;
    const subjects = data.subjects.filter((subject) => subject.contestId === data.activeContestId);
    const selectedSubjectId = record?.subjectId ?? defaults?.subjectId ?? subjects[0]?.id ?? "";
    const subject = DomHelpers.createSelect(
      subjects.map((entry) => [entry.id, entry.name]),
      selectedSubjectId
    );
    subject.dataset.recordEditorSubject = "true";
    const resource = DomHelpers.createSelect(
      this.resourceOptions(data, selectedSubjectId),
      record?.resourceId ?? defaults?.resourceId ?? ""
    );
    resource.dataset.recordEditorResource = "true";
    const topic = DomHelpers.createSelect(
      this.topicOptions(data, selectedSubjectId),
      record?.topicId ?? ""
    );
    topic.dataset.recordEditorTopic = "true";
    const quantity = DomHelpers.createInput(
      "number",
      "Quantidade",
      record?.quantity !== undefined ? String(record.quantity) : ""
    );
    quantity.dataset.recordEditorQuantity = "true";
    const unit = DomHelpers.createSelect(goalUnitOptions(), record?.unit ?? GoalUnit.PAGINAS);
    unit.dataset.recordEditorUnit = "true";
    const correct = DomHelpers.createInput(
      "number",
      "Acertos",
      record?.correctAnswers !== undefined ? String(record.correctAnswers) : ""
    );
    correct.dataset.recordEditorCorrect = "true";
    const completed = DomHelpers.createElement("input");
    completed.type = "checkbox";
    completed.checked = record?.completed ?? true;
    completed.dataset.recordEditorCompleted = "true";

    subject.addEventListener("change", () => {
      DomHelpers.replaceSelectOptions(resource, this.resourceOptions(data, subject.value));
      DomHelpers.replaceSelectOptions(topic, this.topicOptions(data, subject.value));
    });

    const controls = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    controls.append(
      DomHelpers.createIconButton("up", "Subir registro", {
        dataset: { recordEditorMoveUp: "true" },
        onClick: () => {
          const previous = row.previousElementSibling;
          if (previous) {
            row.parentElement?.insertBefore(row, previous);
            this.refreshRecordEditorIndexes(row.parentElement);
          }
        }
      }),
      DomHelpers.createIconButton("down", "Descer registro", {
        dataset: { recordEditorMoveDown: "true" },
        onClick: () => {
          const next = row.nextElementSibling;
          if (next) {
            row.parentElement?.insertBefore(next, row);
            this.refreshRecordEditorIndexes(row.parentElement);
          }
        }
      }),
      DomHelpers.createIconButton("delete", "Remover registro", {
        dataset: { recordEditorRemove: "true" },
        onClick: () => {
          const list = row.parentElement;
          if (!list || list.querySelectorAll(".leif-session-record-editor").length <= 1) return;
          row.remove();
          this.refreshRecordEditorIndexes(list);
        }
      })
    );

    row.append(
      DomHelpers.createStackedLabel("Matéria", subject),
      DomHelpers.createStackedLabel("Recurso", resource),
      DomHelpers.createStackedLabel("Assunto", topic),
      DomHelpers.createStackedLabel("Quantidade", quantity),
      DomHelpers.createStackedLabel("Unidade", unit),
      DomHelpers.createStackedLabel("Acertos", correct),
      DomHelpers.createLabel("Concluído", completed),
      controls
    );
    return row;
  }

  private readRecordEditors(container: HTMLElement): RegisterStudyRecordInput[] {
    return Array.from(container.querySelectorAll<HTMLElement>(".leif-session-record-editor")).map(
      (row) => {
        const quantity = this.optionalNumber(
          row.querySelector<HTMLInputElement>("[data-record-editor-quantity]")?.value
        );
        const unit = row.querySelector<HTMLSelectElement>("[data-record-editor-unit]")?.value;
        return {
          id: row.dataset.recordId,
          subjectId:
            row.querySelector<HTMLSelectElement>("[data-record-editor-subject]")?.value ?? "",
          resourceId:
            row.querySelector<HTMLSelectElement>("[data-record-editor-resource]")?.value ||
            undefined,
          topicId:
            row.querySelector<HTMLSelectElement>("[data-record-editor-topic]")?.value || undefined,
          quantity,
          unit: quantity !== undefined && unit !== undefined && isGoalUnit(unit) ? unit : undefined,
          correctAnswers: this.optionalNumber(
            row.querySelector<HTMLInputElement>("[data-record-editor-correct]")?.value
          ),
          completed:
            row.querySelector<HTMLInputElement>("[data-record-editor-completed]")?.checked ?? false
        };
      }
    );
  }

  private renderCreateForm(data: LeifPluginData, contestId: string): HTMLElement {
    const form = DomHelpers.createForm(async () => {
      const result = await this.registerSession.execute({
        id: createLeifId(),
        contestId,
        date: date.value,
        records: this.readRecordEditors(records)
      });
      this.cycleUndo = result.cycleAdvanced
        ? {
            contestId,
            expectedCurrent: result.newPosition,
            restoreTo: result.previousPosition
          }
        : null;
      this.recommendedRegistration = null;
      await this.onUpdate();
    });
    form.className = "leif-card";
    form.appendChild(DomHelpers.createSectionSubtitle("Novo registro"));
    const date = DomHelpers.createInput("date", "Data", new Date().toISOString().slice(0, 10));
    const records = DomHelpers.createElement("div", "leif-session-record-editor-list");
    records.appendChild(this.renderRecordEditor(data, undefined, this.recommendedRegistration));
    this.refreshRecordEditorIndexes(records);

    const actions = DomHelpers.createElement("div", "leif-form-actions");
    actions.append(
      DomHelpers.createButton("Adicionar registro", {
        dataset: { sessionCreateAddRecord: "true" },
        onClick: () => {
          records.appendChild(this.renderRecordEditor(data));
          this.refreshRecordEditorIndexes(records);
        }
      }),
      DomHelpers.createButton("Registrar", {
        className: "mod-cta",
        dataset: { sessionCreateSave: "true" },
        onClick: async () => {
          const result = await this.registerSession.execute({
            id: createLeifId(),
            contestId,
            date: date.value,
            records: this.readRecordEditors(records)
          });
          this.cycleUndo = result.cycleAdvanced
            ? {
                contestId,
                expectedCurrent: result.newPosition,
                restoreTo: result.previousPosition
              }
            : null;
          this.recommendedRegistration = null;
          await this.onUpdate();
        }
      })
    );
    form.append(DomHelpers.createStackedLabel("Data", date), records, actions);
    return form;
  }

  private resourceOptions(data: LeifPluginData, subjectId: string): Array<[string, string]> {
    return [
      ["", "Sem recurso"],
      ...data.resources
        .filter((resource) => resource.subjectId === subjectId)
        .sort((left, right) => left.order - right.order)
        .map((resource): [string, string] => [resource.id, resource.title])
    ];
  }

  private topicOptions(data: LeifPluginData, subjectId: string): Array<[string, string]> {
    return [
      ["", "Sem assunto"],
      ...data.topics
        .filter((topic) => topic.subjectId === subjectId)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((topic): [string, string] => [topic.id, topic.name])
    ];
  }

  private refreshRecordEditorIndexes(container: Element | null): void {
    if (!container) return;
    Array.from(container.querySelectorAll<HTMLElement>(".leif-session-record-editor")).forEach(
      (row, index) => {
        row.dataset.recordEditorIndex = String(index);
      }
    );
  }

  private optionalNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "erro desconhecido";
  }

  private compareSessionsByDateTime(left: StudySession, right: StudySession): number {
    const leftKey = `${left.date}T${left.startTime ?? "00:00"}`;
    const rightKey = `${right.date}T${right.startTime ?? "00:00"}`;
    return rightKey.localeCompare(leftKey);
  }

  private formatSessionDate(date: string): string {
    const [year, month, day] = date.split("-");
    if (!year || !month || !day) return date;
    return `${day}/${month}/${year}`;
  }

  private formatRecordResult(record: StudyRecord): string {
    const quantity =
      record.quantity !== undefined && record.unit
        ? formatGoalQuantity(record.quantity, record.unit)
        : "Sem quantidade";
    if (record.correctAnswers !== undefined && record.quantity !== undefined) {
      const percentage =
        record.quantity === 0 ? 0 : Math.round((record.correctAnswers / record.quantity) * 100);
      return `${percentage}% (${record.correctAnswers}/${record.quantity})`;
    }
    return record.completed ? `${quantity} · concluído` : quantity;
  }
}
