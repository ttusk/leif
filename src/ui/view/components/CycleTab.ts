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
    header.appendChild(DomHelpers.createSectionTitle("Ciclo e Matérias"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Nova matéria", {
        onClick: () => this.openCreateSubjectModal(data)
      })
    );
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph("Gerencie a ordem, o status, o tempo e a etapa das matérias.")
    );

    const activeContest =
      data.contests.find((contest) => contest.id === data.activeContestId) ?? null;
    const subjects = await this.listSubjectsForActiveContestUseCase.execute();
    const card = DomHelpers.createCard(
      activeContest ? `Matérias de ${activeContest.name}` : "Matérias"
    );

    if (subjects.length === 0) {
      card.appendChild(
        DomHelpers.createParagraph("Nenhuma matéria cadastrada para o concurso ativo.")
      );
      container.appendChild(card);
      return;
    }

    const tableWrapper = DomHelpers.createElement("div", "leif-table-wrapper");
    const table = DomHelpers.createElement("table", "leif-table");

    // Header
    const thead = DomHelpers.createElement("thead");
    const headerRow = DomHelpers.createElement("tr");
    ["Ordem", "Matéria", "Tempo", "Etapa", "Status", "Ações"].forEach((header) => {
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
    _subjects: Subject[],
    _index: number,
    activeContestId: string | null
  ): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.appendChild(DomHelpers.createCell(String(subject.order)));
    tr.appendChild(DomHelpers.createCell(subject.name));
    tr.appendChild(DomHelpers.createCell(`${subject.plannedStudyMinutes} min`));
    tr.appendChild(DomHelpers.createCell(subject.currentStage ?? "—"));
    tr.appendChild(this.renderStatusCell(subject, activeContestId));
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
    minutesInput.className = "leif-input leif-input-compact";

    const stageInput = DomHelpers.createInput("text", "Etapa", subject.currentStage ?? "");
    stageInput.className = "leif-input leif-input-compact";

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
          DomHelpers.notifyError(error, "Não foi possível salvar a configuração.");
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

    // Reorder buttons available while editing too
    if (index > 0) {
      controls.appendChild(
        DomHelpers.createIconButton("up", "Subir", {
          onClick: async () => {
            await this.moveSubject(subjects, index, index - 1, activeContestId);
          }
        })
      );
    }
    if (index < subjects.length - 1) {
      controls.appendChild(
        DomHelpers.createIconButton("down", "Descer", {
          onClick: async () => {
            await this.moveSubject(subjects, index, index + 1, activeContestId);
          }
        })
      );
    }

    tr.appendChild(DomHelpers.createCell(String(subject.order)));
    tr.appendChild(DomHelpers.createCell(subject.name));
    tr.appendChild(DomHelpers.createCell(null, minutesInput));
    tr.appendChild(DomHelpers.createCell(null, stageInput));
    tr.appendChild(DomHelpers.createCell(subject.isActive ? "Ativa" : "Inativa"));
    tr.appendChild(DomHelpers.createCell(null, controls));
    return tr;
  }

  private openCreateSubjectModal(data: LeifPluginData): void {
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
        modal.close();
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não foi possível criar a matéria.");
      }
    });

    form.append(
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createLabel("Minutos", minutesInput)
    );

    const modal = DomHelpers.createModal({
      title: "Nova matéria",
      content: form,
      onSubmit: () => form.requestSubmit()
    });

    modal.open();
  }

  private renderStatusCell(
    subject: Subject,
    activeContestId: string | null
  ): HTMLElement {
    const td = DomHelpers.createElement("td", "leif-status-cell");
    const span = DomHelpers.createElement("span", subject.isActive ? "leif-status-active" : "leif-status-inactive");
    span.textContent = subject.isActive ? "Ativa" : "Inativa";
    td.appendChild(span);

    td.addEventListener("click", async () => {
      try {
        await this.setSubjectActiveStateUseCase.execute({
          subjectId: subject.id,
          isActive: !subject.isActive
        });
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não foi possível alterar o status da matéria.");
      }
    });

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
      DomHelpers.notifyError(error, "Não foi possível reordenar as matérias.");
    }
  }
}
