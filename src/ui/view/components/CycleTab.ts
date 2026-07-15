import { Notice } from "obsidian";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
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
 * Inline editing: clicking the pencil icon on a row transforms the row into an editable form.
 */
export class CycleTab {
  private readonly createSubjectUseCase: CreateSubjectUseCase;
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
    this.listSubjectsForActiveContestUseCase = new ListSubjectsForActiveContestUseCase(dataStore);
    this.reorderSubjectsUseCase = new ReorderSubjectsUseCase(dataStore, repositoryFactory);
    this.setSubjectActiveStateUseCase = new SetSubjectActiveStateUseCase(dataStore, repositoryFactory);
    this.updateSubjectConfigurationUseCase = new UpdateSubjectConfigurationUseCase(dataStore, repositoryFactory);
  }

  /**
   * Renders the cycle tab content.
   */
  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Plano"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Nova matéria", {
        onClick: async () => {
          this.isCreatingSubject = true;
          await this.onUpdate();
        }
      })
    );
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph("Ajuste a ordem das matérias e o tempo de cada uma.")
    );

    if (this.isCreatingSubject) {
      container.appendChild(this.renderCreateSubjectForm(data));
    }

    const activeContest =
      data.contests.find((contest) => contest.id === data.activeContestId) ?? null;
    const subjects = await this.listSubjectsForActiveContestUseCase.execute();
    const card = DomHelpers.createCard(
      activeContest ? `Matérias de ${activeContest.name}` : "Matérias"
    );

    if (subjects.length === 0) {
      card.appendChild(
        DomHelpers.createParagraph("Ainda não há matérias nesse concurso.")
      );
      container.appendChild(card);
      return;
    }

    const tableWrapper = DomHelpers.createElement("div", "leif-table-wrapper");
    const table = DomHelpers.createElement("table", "leif-table");

    // Header
    const thead = DomHelpers.createElement("thead");
    const headerRow = DomHelpers.createElement("tr");
    ["Ordem", "Matéria", "Tempo", "Etapa", "Ciclo", "Ações"].forEach((header) => {
      const th = DomHelpers.createElement("th");
      th.textContent = header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = DomHelpers.createElement("tbody");
    subjects.forEach((subject, index) => {
      const isEditing = this.editingSubjectId === subject.id;
      const tr = isEditing
        ? this.renderEditableRow(subject, subjects, index, data.activeContestId)
        : this.renderDisplayRow(subject, subjects, index, data.activeContestId);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    card.appendChild(tableWrapper);

    container.appendChild(card);
  }

  private renderDisplayRow(
    subject: Subject,
    subjects: Subject[],
    index: number,
    activeContestId: string | null
  ): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.appendChild(this.renderOrderCell(subject, subjects, index, activeContestId));
    tr.appendChild(DomHelpers.createCell(subject.name));
    tr.appendChild(DomHelpers.createCell(`${subject.plannedStudyMinutes} min`));
    tr.appendChild(DomHelpers.createCell(subject.currentStage ?? "—"));
    tr.appendChild(this.renderStatusCell(subject));
    tr.appendChild(DomHelpers.createCell(null, this.renderEditCell(subject)));
    return tr;
  }

  private renderEditableRow(
    subject: Subject,
    subjects: Subject[],
    index: number,
    activeContestId: string | null
  ): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-editing-row";

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

    const controls = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    controls.appendChild(saveButton);
    controls.appendChild(cancelButton);

    tr.appendChild(this.renderOrderCell(subject, subjects, index, activeContestId));
    tr.appendChild(DomHelpers.createCell(subject.name));
    tr.appendChild(DomHelpers.createCell(null, minutesInput));
    tr.appendChild(DomHelpers.createCell(null, stageInput));
    tr.appendChild(DomHelpers.createCell(subject.isActive ? "No ciclo" : "Pausada"));
    tr.appendChild(DomHelpers.createCell(null, controls));
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

  private renderStatusCell(subject: Subject): HTMLElement {
    const td = DomHelpers.createElement("td", "leif-status-cell");
    const wrapper = DomHelpers.createElement("div", "leif-cycle-status-control");
    const status = DomHelpers.createElement("span", subject.isActive ? "leif-status-active" : "leif-status-inactive");
    status.textContent = subject.isActive ? "No ciclo" : "Pausada";
    const button = DomHelpers.createButton(subject.isActive ? "Pausar" : "Ativar", {
      dataset: { subjectCycleToggleId: subject.id },
      onClick: async () => {
        try {
          const nextState = !subject.isActive;
          await this.setSubjectActiveStateUseCase.execute({
            subjectId: subject.id,
            isActive: nextState
          });
          new Notice(nextState ? `${subject.name} voltou para o ciclo.` : `${subject.name} saiu do ciclo.`);
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
    wrapper.append(status, button);
    td.appendChild(wrapper);

    return td;
  }

  private renderOrderCell(
    subject: Subject,
    subjects: Subject[],
    index: number,
    activeContestId: string | null
  ): HTMLElement {
    const td = DomHelpers.createElement("td", "leif-order-cell");
    const content = DomHelpers.createElement("div", "leif-order-control");
    const order = DomHelpers.createElement("span", "leif-order-number");
    const buttons = DomHelpers.createElement("div", "leif-order-actions");

    order.textContent = String(subject.order);
    content.appendChild(order);

    if (index > 0) {
      buttons.appendChild(
        DomHelpers.createIconButton("up", "Subir", {
          onClick: async () => {
            await this.moveSubject(subjects, index, index - 1, activeContestId);
          }
        })
      );
    }
    if (index < subjects.length - 1) {
      buttons.appendChild(
        DomHelpers.createIconButton("down", "Descer", {
          onClick: async () => {
            await this.moveSubject(subjects, index, index + 1, activeContestId);
          }
        })
      );
    }

    content.appendChild(buttons);
    td.appendChild(content);
    return td;
  }

  private renderEditCell(subject: Subject): HTMLElement {
    const cell = DomHelpers.createElement("div", "leif-edit-cell");
    cell.appendChild(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingSubjectId = subject.id;
          await this.onUpdate();
        }
      })
    );
    return cell;
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
