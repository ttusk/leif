import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { AdvanceCycleUseCase } from "@/application/use-cases/AdvanceCycleUseCase";
import { DeleteStudyRecordUseCase } from "@/application/use-cases/DeleteStudyRecordUseCase";
import {
  type RegisterStudyRecordInput,
  RegisterStudyRecordsUseCase
} from "@/application/use-cases/RegisterStudyRecordsUseCase";
import { RestoreCyclePositionUseCase } from "@/application/use-cases/RestoreCyclePositionUseCase";
import { UpdateStudyRecordUseCase } from "@/application/use-cases/UpdateStudyRecordUseCase";
import type { CyclePosition } from "@/domain/entities/CycleState";
import type { StudyRecord } from "@/domain/entities/StudyRecord";
import { GoalUnit, isGoalUnit } from "@/domain/types/GoalUnit";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { ConfirmationModal } from "@/ui/confirmation/ConfirmationModal";
import type { RecommendedStudyRegistration } from "@/ui/view/components/DashboardTab";
import { CycleRecommendationPanel } from "@/ui/view/shared/CycleRecommendationPanel";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { formatGoalQuantity, goalUnitOptions } from "@/ui/view/shared/StudyLabels";
import type { App } from "obsidian";

interface RecordFilters {
  subjectId: string;
  fromDate: string;
  toDate: string;
}

interface CycleUndoState {
  contestId: string;
  expectedCurrent: CyclePosition;
  restoreTo: CyclePosition;
}

/**
 * Records tab. The historical class name is kept to avoid changing view
 * composition, but every saved StudyRecord is independent.
 */
export class SessionsTab {
  private readonly registerRecords: RegisterStudyRecordsUseCase;
  private readonly advanceCycle: AdvanceCycleUseCase;
  private readonly updateRecord: UpdateStudyRecordUseCase;
  private readonly restoreCyclePosition: RestoreCyclePositionUseCase;
  private readonly deleteRecord: DeleteStudyRecordUseCase;
  private readonly recommendation: CycleRecommendationPanel;
  private readonly filters: RecordFilters = {
    subjectId: "",
    fromDate: "",
    toDate: ""
  };
  private cycleUndo: CycleUndoState | null = null;
  private recordEditorError: string | null = null;
  private editingRecordId: string | null = null;
  private recommendedRegistration: RecommendedStudyRegistration | null = null;

  constructor(
    private readonly app: App,
    dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    this.registerRecords = new RegisterStudyRecordsUseCase(dataStore);
    this.advanceCycle = new AdvanceCycleUseCase(dataStore);
    this.updateRecord = new UpdateStudyRecordUseCase(dataStore);
    this.restoreCyclePosition = new RestoreCyclePositionUseCase(dataStore);
    this.deleteRecord = new DeleteStudyRecordUseCase(dataStore);
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
    container.appendChild(this.renderRecordHistory(data, contestId));
  }

  private renderCycleUndoFeedback(): HTMLElement {
    const feedback = DomHelpers.createElement("div", "leif-record-feedback");
    feedback.setAttribute("role", "status");
    feedback.append(
      DomHelpers.createParagraph("Recomendação avançada."),
      DomHelpers.createButton("Desfazer avanço da recomendação", {
        dataset: { recordCycleUndo: "true" },
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

  private renderRecordHistory(data: LeifPluginData, contestId: string): HTMLElement {
    const history = DomHelpers.createElement("section", "leif-record-history");
    history.appendChild(DomHelpers.createSectionSubtitle("Histórico"));
    history.appendChild(this.renderRecordFilters(data, contestId));

    const records = data.studyRecords
      .filter((record) => record.contestId === contestId)
      .filter((record) => this.recordMatchesFilters(record))
      .sort((left, right) => this.compareRecordsByDate(left, right));

    if (data.studyRecords.every((record) => record.contestId !== contestId)) {
      history.appendChild(
        DomHelpers.createEmptyState("Sem registros", "Os registros salvos aparecerão aqui.")
      );
      return history;
    }
    if (records.length === 0) {
      history.appendChild(
        DomHelpers.createEmptyState(
          "Nenhum registro encontrado",
          "Ajuste os filtros para ver mais registros."
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
    tableContainer.querySelector("table")?.classList.add("leif-record-table");
    records.forEach((record) => tbody.appendChild(this.renderRecordRow(data, record)));
    history.appendChild(tableContainer);

    const editing = records.find((record) => record.id === this.editingRecordId);
    if (editing) {
      history.appendChild(this.renderRecordEditForm(data, editing));
    }
    return history;
  }

  private renderRecordFilters(data: LeifPluginData, contestId: string): HTMLElement {
    const filters = DomHelpers.createElement("div", "leif-record-filters");
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
    subject.dataset.recordFilterSubject = "true";
    const from = DomHelpers.createInput("date", "De", this.filters.fromDate);
    from.dataset.recordFilterFrom = "true";
    const to = DomHelpers.createInput("date", "Até", this.filters.toDate);
    to.dataset.recordFilterTo = "true";

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

  private recordMatchesFilters(record: StudyRecord): boolean {
    if (this.filters.subjectId && record.subjectId !== this.filters.subjectId) return false;
    if (this.filters.fromDate && record.date < this.filters.fromDate) return false;
    if (this.filters.toDate && record.date > this.filters.toDate) return false;
    return true;
  }

  private renderRecordRow(data: LeifPluginData, record: StudyRecord): HTMLTableRowElement {
    const row = DomHelpers.createElement("tr", "leif-study-record");
    row.dataset.recordId = record.id;
    const subject = data.subjects.find((entry) => entry.id === record.subjectId);
    const resource = record.resourceId
      ? data.resources.find((entry) => entry.id === record.resourceId)
      : undefined;
    const topic = record.topicId
      ? data.topics.find((entry) => entry.id === record.topicId)
      : undefined;
    const dateContent = DomHelpers.createElement("div", "leif-record-date");
    dateContent.appendChild(DomHelpers.createStrong(this.formatDate(record.date)));
    if (record.notes) {
      const notes = DomHelpers.createElement("span", "leif-record-note");
      notes.textContent = record.notes;
      dateContent.appendChild(notes);
    }

    row.append(
      DomHelpers.createCell(null, dateContent, "leif-table-cell-numeric"),
      DomHelpers.createNameCell(subject?.name ?? "Matéria removida"),
      DomHelpers.createNameCell(resource?.title ?? "Sem recurso"),
      DomHelpers.createNameCell(topic?.name ?? "Sem assunto"),
      DomHelpers.createNumericCell(this.formatRecordResult(record)),
      DomHelpers.createActionsCell(this.renderRecordMenu(record))
    );
    return row;
  }

  private renderRecordMenu(record: StudyRecord): HTMLElement {
    return DomHelpers.createMenuButton(
      [
        {
          label: "Editar registro",
          icon: "edit",
          onClick: async () => {
            this.editingRecordId = record.id;
            this.recordEditorError = null;
            await this.onUpdate();
          }
        },
        {
          label: "Excluir registro",
          icon: "trash-2",
          onClick: async () => {
            const confirmed = await ConfirmationModal.ask(this.app, {
              title: "Excluir registro?",
              message: `O registro de ${this.formatDate(record.date)} será excluído.`,
              confirmLabel: "Excluir registro"
            });
            if (!confirmed) return;
            await this.deleteRecord.execute({ recordId: record.id });
            if (this.editingRecordId === record.id) this.editingRecordId = null;
            await this.onUpdate();
          }
        }
      ],
      `Ações do registro de ${this.formatDate(record.date)}`
    );
  }

  private renderRecordEditForm(data: LeifPluginData, record: StudyRecord): HTMLElement {
    const date = DomHelpers.createInput("date", "Data", record.date);
    date.dataset.recordEditDate = "true";
    const notes = DomHelpers.createTextarea("Notas", record.notes ?? "");
    notes.dataset.recordEditNotes = "true";
    const fields = this.renderRecordFields(data, record);

    const saveRecord = async () => {
      try {
        const input = this.readRecordFields(fields);
        await this.updateRecord.execute({
          recordId: record.id,
          date: date.value,
          subjectId: input.subjectId,
          resourceId: input.resourceId ?? null,
          topicId: input.topicId ?? null,
          quantity: input.quantity ?? null,
          unit: input.unit ?? null,
          correctAnswers: input.correctAnswers ?? null,
          completed: input.completed,
          notes: notes.value || null
        });
        this.recordEditorError = null;
        this.editingRecordId = null;
        await this.onUpdate();
      } catch (error) {
        this.recordEditorError = `Não foi possível salvar o registro: ${this.errorMessage(error)}`;
        await this.onUpdate();
      }
    };

    const form = DomHelpers.createForm(saveRecord);
    form.className = "leif-record-editor-form";
    form.appendChild(DomHelpers.createSectionSubtitle("Editar registro"));
    if (this.recordEditorError) {
      const error = DomHelpers.createElement("div", "leif-record-editor-error");
      error.setAttribute("role", "alert");
      error.textContent = this.recordEditorError;
      form.appendChild(error);
    }
    form.append(
      DomHelpers.createStackedLabel("Data", date),
      DomHelpers.createStackedLabel("Notas", notes),
      fields
    );

    const actions = DomHelpers.createElement("div", "leif-form-actions");
    actions.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.editingRecordId = null;
          this.recordEditorError = null;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Salvar registro", {
        onClick: saveRecord,
        className: "mod-cta",
        dataset: { recordEditSave: "true" }
      })
    );
    form.appendChild(actions);
    return form;
  }

  private renderRecordFields(
    data: LeifPluginData,
    record?: StudyRecord,
    defaults?: RecommendedStudyRegistration | null,
    draftControls = false
  ): HTMLElement {
    const row = DomHelpers.createElement("div", "leif-record-fields");
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

    row.append(
      DomHelpers.createStackedLabel("Matéria", subject),
      DomHelpers.createStackedLabel("Recurso", resource),
      DomHelpers.createStackedLabel("Assunto", topic),
      DomHelpers.createStackedLabel("Quantidade", quantity),
      DomHelpers.createStackedLabel("Unidade", unit),
      DomHelpers.createStackedLabel("Acertos", correct),
      DomHelpers.createLabel("Concluído", completed)
    );

    if (draftControls) {
      const controls = DomHelpers.createElement(
        "div",
        "leif-inline-actions leif-inline-actions-compact"
      );
      controls.append(
        DomHelpers.createIconButton("up", "Subir registro", {
          dataset: { recordDraftMoveUp: "true" },
          onClick: () => {
            const previous = row.previousElementSibling;
            if (previous) {
              row.parentElement?.insertBefore(row, previous);
              this.refreshDraftIndexes(row.parentElement);
            }
          }
        }),
        DomHelpers.createIconButton("down", "Descer registro", {
          dataset: { recordDraftMoveDown: "true" },
          onClick: () => {
            const next = row.nextElementSibling;
            if (next) {
              row.parentElement?.insertBefore(next, row);
              this.refreshDraftIndexes(row.parentElement);
            }
          }
        }),
        DomHelpers.createIconButton("delete", "Remover registro", {
          dataset: { recordDraftRemove: "true" },
          onClick: () => {
            const list = row.parentElement;
            if (!list || list.querySelectorAll(".leif-record-fields").length <= 1) return;
            row.remove();
            this.refreshDraftIndexes(list);
          }
        })
      );
      row.appendChild(controls);
    }
    return row;
  }

  private readRecordFields(row: HTMLElement): RegisterStudyRecordInput {
    const quantity = this.optionalNumber(
      row.querySelector<HTMLInputElement>("[data-record-editor-quantity]")?.value
    );
    const unit = row.querySelector<HTMLSelectElement>("[data-record-editor-unit]")?.value;
    return {
      id: row.dataset.recordId,
      subjectId: row.querySelector<HTMLSelectElement>("[data-record-editor-subject]")?.value ?? "",
      resourceId:
        row.querySelector<HTMLSelectElement>("[data-record-editor-resource]")?.value || undefined,
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

  private readRecordDrafts(container: HTMLElement): RegisterStudyRecordInput[] {
    return Array.from(container.querySelectorAll<HTMLElement>(".leif-record-fields")).map((row) =>
      this.readRecordFields(row)
    );
  }

  private renderCreateForm(data: LeifPluginData, contestId: string): HTMLElement {
    const date = DomHelpers.createInput("date", "Data", new Date().toISOString().slice(0, 10));
    const drafts = DomHelpers.createElement("div", "leif-record-draft-list");
    drafts.appendChild(
      this.renderRecordFields(data, undefined, this.recommendedRegistration, true)
    );
    this.refreshDraftIndexes(drafts);

    const saveRecords = async () => {
      await this.registerRecords.execute({
        contestId,
        date: date.value,
        records: this.readRecordDrafts(drafts)
      });
      this.recommendedRegistration = null;
      await this.onUpdate();
    };
    const form = DomHelpers.createForm(saveRecords);
    form.className = "leif-card";
    form.appendChild(DomHelpers.createSectionSubtitle("Novos registros"));

    const actions = DomHelpers.createElement("div", "leif-form-actions");
    actions.append(
      DomHelpers.createButton("Adicionar registro", {
        dataset: { recordCreateAdd: "true" },
        onClick: () => {
          drafts.appendChild(this.renderRecordFields(data, undefined, null, true));
          this.refreshDraftIndexes(drafts);
        }
      }),
      DomHelpers.createButton("Registrar", {
        className: "mod-cta",
        dataset: { recordCreateSave: "true" },
        onClick: saveRecords
      })
    );
    form.append(DomHelpers.createStackedLabel("Data", date), drafts, actions);
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

  private refreshDraftIndexes(container: Element | null): void {
    if (!container) return;
    Array.from(container.querySelectorAll<HTMLElement>(".leif-record-fields")).forEach(
      (row, index) => {
        row.dataset.recordDraftIndex = String(index);
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

  private compareRecordsByDate(left: StudyRecord, right: StudyRecord): number {
    const byDate = right.date.localeCompare(left.date);
    return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
  }

  private formatDate(date: string): string {
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
