import { Notice } from "obsidian";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import {
  GetActiveContestSummaryUseCase,
  type SubjectSummary
} from "@/application/use-cases/GetActiveContestSummaryUseCase";
import { ListSubjectsForActiveContestUseCase } from "@/application/use-cases/ListSubjectsForActiveContestUseCase";
import { ReorderSubjectsUseCase } from "@/application/use-cases/ReorderSubjectsUseCase";
import { SetSubjectActiveStateUseCase } from "@/application/use-cases/SetSubjectActiveStateUseCase";
import { UpdateSubjectConfigurationUseCase } from "@/application/use-cases/UpdateSubjectConfigurationUseCase";
import type { Subject } from "@/domain/entities/Subject";
import { NoActiveContestError } from "@/domain/errors/DomainErrors";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { createId } from "@/application/Id";

/**
 * Cycle tab component - manages subjects, order, status, time and stage.
 * Inline editing: clicking the pencil icon on a card transforms the card into an editable form.
 */
export class CycleTab {
  private readonly createSubjectUseCase: CreateSubjectUseCase;
  private readonly getActiveContestSummaryUseCase: GetActiveContestSummaryUseCase;
  private readonly listSubjectsForActiveContestUseCase: ListSubjectsForActiveContestUseCase;
  private readonly reorderSubjectsUseCase: ReorderSubjectsUseCase;
  private readonly setSubjectActiveStateUseCase: SetSubjectActiveStateUseCase;
  private readonly updateSubjectConfigurationUseCase: UpdateSubjectConfigurationUseCase;
  private editingSubjectId: string | null = null;
  private isCreatingSubject = false;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.createSubjectUseCase = new CreateSubjectUseCase(dataStore, repositoryFactory);
    this.getActiveContestSummaryUseCase = new GetActiveContestSummaryUseCase(dataStore);
    this.listSubjectsForActiveContestUseCase = new ListSubjectsForActiveContestUseCase(dataStore);
    this.reorderSubjectsUseCase = new ReorderSubjectsUseCase(dataStore, repositoryFactory);
    this.setSubjectActiveStateUseCase = new SetSubjectActiveStateUseCase(
      dataStore,
      repositoryFactory
    );
    this.updateSubjectConfigurationUseCase = new UpdateSubjectConfigurationUseCase(
      dataStore,
      repositoryFactory
    );
  }

  /**
   * Renders the cycle tab content.
   */
  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Matérias"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Nova matéria", {
        onClick: async () => {
          this.isCreatingSubject = true;
          await this.onUpdate();
        }
      })
    );
    container.appendChild(header);

    if (this.isCreatingSubject) {
      container.appendChild(this.renderCreateSubjectForm(data));
    }

    const activeContest =
      data.contests.find((contest) => contest.id === data.activeContestId) ?? null;
    const subjects = await this.listSubjectsForActiveContestUseCase.execute();
    const summary = await this.getActiveContestSummaryUseCase.execute();
    const summaryBySubject = new Map(
      summary.subjectSummaries.map((subjectSummary) => [subjectSummary.subjectId, subjectSummary])
    );
    const card = DomHelpers.createCard(
      activeContest ? `Matérias de ${activeContest.name}` : "Matérias"
    );

    if (subjects.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Ainda não há matérias nesse concurso."));
      container.appendChild(card);
      return;
    }

    const activeMinutes = subjects
      .filter((subject) => subject.isActive)
      .reduce((total, subject) => total + subject.plannedStudyMinutes, 0);
    const summaryBar = DomHelpers.createElement("div", "leif-cycle-summary");
    summaryBar.append(
      this.renderSummaryChip("Matérias", String(subjects.length)),
      this.renderSummaryChip(
        "No ciclo",
        String(subjects.filter((subject) => subject.isActive).length)
      ),
      this.renderSummaryChip("Tempo total", `${activeMinutes} min`)
    );
    card.appendChild(summaryBar);

    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Ordem",
      "Matéria",
      "Status",
      "Tempo",
      "Etapa",
      "Questões",
      "Ações"
    ]);

    subjects.forEach((subject, index) => {
      const isEditing = this.editingSubjectId === subject.id;
      tbody.appendChild(
        isEditing
          ? this.renderEditableRow(subject)
          : this.renderDisplayRow(
              subject,
              subjects,
              index,
              data.activeContestId,
              summaryBySubject.get(subject.id)
            )
      );
    });
    card.appendChild(tableContainer);

    container.appendChild(card);
  }

  private renderDisplayRow(
    subject: Subject,
    subjects: Subject[],
    index: number,
    activeContestId: string | null,
    summary?: SubjectSummary
  ): HTMLTableRowElement {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.subjectId = subject.id;
    if (!subject.isActive) {
      tr.classList.add("is-paused");
    }

    const orderControl = DomHelpers.createElement("div", "leif-order-control");
    const order = DomHelpers.createElement("span", "leif-order-number");
    order.textContent = String(subject.order);
    const orderActions = DomHelpers.createElement("span", "leif-order-actions");
    orderActions.append(
      this.renderMoveButton(
        "up",
        "Subir",
        async () => {
          await this.moveSubject(subjects, index, index - 1, activeContestId);
        },
        index === 0
      ),
      this.renderMoveButton(
        "down",
        "Descer",
        async () => {
          await this.moveSubject(subjects, index, index + 1, activeContestId);
        },
        index === subjects.length - 1
      )
    );
    orderControl.append(order, orderActions);

    const title = DomHelpers.createElement("strong", "leif-cycle-table-title");
    title.textContent = subject.name;
    const status = DomHelpers.createElement(
      "span",
      `leif-cycle-status ${subject.isActive ? "leif-status-active" : "leif-status-inactive"}`
    );
    status.textContent = subject.isActive ? "No ciclo" : "Pausada";

    const actions = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    actions.appendChild(
      DomHelpers.createOverflowMenu([
        this.renderCycleToggleButton(subject),
        DomHelpers.createIconButton("edit", "Editar", {
          onClick: async () => {
            this.editingSubjectId = subject.id;
            await this.onUpdate();
          }
        })
      ])
    );

    tr.append(
      DomHelpers.createCell(null, orderControl),
      DomHelpers.createCell(null, title),
      DomHelpers.createCell(null, status),
      DomHelpers.createCell(`${subject.plannedStudyMinutes} min`),
      DomHelpers.createCell(subject.currentStage ?? "—"),
      DomHelpers.createCell(this.formatQuestionSummary(summary)),
      DomHelpers.createCell(null, actions)
    );

    return tr;
  }

  private renderEditableRow(subject: Subject): HTMLTableRowElement {
    const tr = DomHelpers.createElement("tr", "leif-editing-row");
    tr.dataset.subjectId = subject.id;

    const minutesInput = DomHelpers.createInput(
      "number",
      "Min",
      String(subject.plannedStudyMinutes)
    );
    minutesInput.size = 8;

    const stageInput = DomHelpers.createInput("text", "Etapa", subject.currentStage ?? "");
    stageInput.size = 12;

    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateSubjectConfigurationUseCase.execute({
            subjectId: subject.id,
            plannedStudyMinutes: Number(minutesInput.value),
            currentStage: stageInput.value
          });
          this.editingSubjectId = null;
          await this.onUpdate();
        } catch (error) {
          DomHelpers.notifyError(error, "Não consegui salvar essa matéria.");
        }
      }
    });

    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingSubjectId = null;
        await this.onUpdate();
      }
    });

    const controls = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    controls.appendChild(saveButton);
    controls.appendChild(cancelButton);

    const order = DomHelpers.createElement("span", "leif-order-number");
    order.textContent = String(subject.order);
    const title = DomHelpers.createElement("strong", "leif-cycle-table-title");
    title.textContent = subject.name;

    tr.append(
      DomHelpers.createCell(null, order),
      DomHelpers.createCell(null, title),
      DomHelpers.createCell("Editando"),
      DomHelpers.createCell(null, minutesInput),
      DomHelpers.createCell(null, stageInput),
      DomHelpers.createCell("—"),
      DomHelpers.createCell(null, controls)
    );
    return tr;
  }

  private renderCreateSubjectForm(data: LeifPluginData): HTMLElement {
    const activeContestId = data.activeContestId;
    const nameInput = DomHelpers.createInput("text", "Nome da matéria");
    const minutesInput = DomHelpers.createInput("number", "Minutos planejados", "60");

    const form = DomHelpers.createForm(async () => {
      try {
        if (!activeContestId) {
          throw new NoActiveContestError();
        }
        await this.createSubjectUseCase.execute({
          id: createId(`${activeContestId}-subject`),
          contestId: activeContestId,
          name: nameInput.value,
          plannedStudyMinutes: Number(minutesInput.value)
        });
        this.isCreatingSubject = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não consegui criar essa matéria.");
      }
    });

    form.classList.add("leif-card");
    form.append(
      DomHelpers.createSectionSubtitle("Nova matéria"),
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createLabel("Minutos", minutesInput),
      DomHelpers.createElement("div", "leif-form-actions")
    );

    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isCreatingSubject = false;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Criar", {
        type: "submit",
        className: "mod-cta"
      })
    );

    return form;
  }

  private renderCycleToggleButton(subject: Subject): HTMLButtonElement {
    const button = DomHelpers.createButton(subject.isActive ? "Pausar" : "Ativar", {
      dataset: { subjectCycleToggleId: subject.id },
      onClick: async () => {
        try {
          const nextState = !subject.isActive;
          await this.setSubjectActiveStateUseCase.execute({
            subjectId: subject.id,
            isActive: nextState
          });
          new Notice(
            nextState ? `${subject.name} voltou para o ciclo.` : `${subject.name} saiu do ciclo.`
          );
          await this.onUpdate();
        } catch (error) {
          DomHelpers.notifyError(error, "Não consegui alterar essa matéria.");
        }
      }
    });
    button.setAttribute(
      "aria-label",
      subject.isActive ? `Pausar ${subject.name} no ciclo` : `Ativar ${subject.name} no ciclo`
    );
    return button;
  }

  private renderMoveButton(
    icon: string,
    label: string,
    onClick: () => Promise<void>,
    disabled: boolean
  ): HTMLButtonElement {
    const button = disabled
      ? DomHelpers.createIconButton(icon, label)
      : DomHelpers.createIconButton(icon, label, { onClick });
    button.disabled = disabled;
    return button;
  }

  private renderSummaryChip(label: string, value: string): HTMLElement {
    const chip = DomHelpers.createElement("span", "leif-next-activity-chip");
    const labelEl = DomHelpers.createElement("span", "leif-next-activity-chip-label");
    labelEl.textContent = `${label}:`;
    const valueEl = DomHelpers.createElement("span", "leif-next-activity-chip-value");
    valueEl.textContent = value;
    chip.append(labelEl, valueEl);
    return chip;
  }

  private formatQuestionSummary(summary?: SubjectSummary): string {
    if (!summary || summary.questionProgressCount === 0 || summary.questionAccuracy === null) {
      return "—";
    }

    const correctAnswers = Math.round(summary.questionAccuracy * summary.questionProgressCount);
    return `${Math.round(summary.questionAccuracy * 100)}% (${correctAnswers}/${summary.questionProgressCount})`;
  }

  private async moveSubject(
    subjects: Subject[],
    sourceIndex: number,
    targetIndex: number,
    activeContestId: string | null
  ): Promise<void> {
    try {
      if (!activeContestId) {
        throw new NoActiveContestError();
      }

      const nextOrder = subjects.map((subject) => subject.id);
      const [subjectId] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, subjectId);

      await this.reorderSubjectsUseCase.execute({
        contestId: activeContestId,
        subjectIdsInOrder: nextOrder
      });
      await this.onUpdate();
    } catch (error) {
      DomHelpers.notifyError(error, "Não consegui reordenar as matérias.");
    }
  }
}
