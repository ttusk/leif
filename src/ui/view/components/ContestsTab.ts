import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { DeleteContestUseCase } from "@/application/use-cases/DeleteContestUseCase";
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import { UpdateContestUseCase } from "@/application/use-cases/UpdateContestUseCase";
import type { Contest } from "@/domain/entities/Contest";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { Notice } from "obsidian";

/**
 * Contests tab component with unified CRUD pattern.
 */
export class ContestsTab {
  private readonly createContestUseCase: CreateContestUseCase;
  private readonly setActiveContestUseCase: SetActiveContestUseCase;
  private readonly updateContestUseCase: UpdateContestUseCase;
  private readonly deleteContestUseCase: DeleteContestUseCase;

  private editingContestId: string | null = null;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.createContestUseCase = new CreateContestUseCase(dataStore, repositoryFactory);
    this.setActiveContestUseCase = new SetActiveContestUseCase(dataStore, repositoryFactory);
    this.updateContestUseCase = new UpdateContestUseCase(dataStore, repositoryFactory);
    this.deleteContestUseCase = new DeleteContestUseCase(dataStore, repositoryFactory);
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Concursos"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Novo concurso", {
        onClick: () => this.openCreateContestModal()
      })
    );
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph("Cadastre concursos e defina qual deles está ativo.")
    );

    const contestsCard = DomHelpers.createCard("Lista de concursos");
    if (data.contests.length === 0) {
      contestsCard.appendChild(DomHelpers.createParagraph("Nenhum concurso cadastrado."));
    }

    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Concurso",
      "ID",
      "Notas",
      "Status",
      "Ações"
    ]);

    data.contests.forEach((contest) => {
      const isEditing = this.editingContestId === contest.id;
      if (isEditing) {
        tbody.appendChild(this.renderEditableRow(contest, data));
      } else {
        tbody.appendChild(this.renderDisplayRow(contest, data));
      }
    });

    contestsCard.appendChild(tableContainer);
    container.appendChild(contestsCard);
  }

  private renderDisplayRow(contest: Contest, data: LeifPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    const isActive = data.activeContestId === contest.id;

    tr.appendChild(DomHelpers.createCell(contest.name));
    tr.appendChild(DomHelpers.createCell(contest.id));
    tr.appendChild(DomHelpers.createCell(contest.wall.notes ?? "—"));
    tr.appendChild(DomHelpers.createCell(isActive ? "Ativo" : "Inativo"));

    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");

    if (!isActive) {
      actions.appendChild(
        DomHelpers.createIconButton("toggleOn", "Ativar", {
          dataset: { contestId: contest.id },
          onClick: async () => {
            try {
              await this.setActiveContestUseCase.execute({ contestId: contest.id });
              await this.onUpdate();
            } catch (error) {
              this.notifyError(error, "Não foi possível ativar o concurso.");
            }
          }
        })
      );
    }

    actions.appendChild(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingContestId = contest.id;
          await this.onUpdate();
        }
      })
    );

    actions.appendChild(
      DomHelpers.createIconButton("delete", "Excluir", {
        onClick: async () => {
          const confirmed = await DomHelpers.confirm({
            title: "Excluir concurso",
            message: `Excluir "${contest.name}"?`,
            confirmLabel: "Excluir"
          });
          if (!confirmed) return;
          try {
            await this.deleteContestUseCase.execute({ contestId: contest.id });
            await this.onUpdate();
          } catch (error) {
            this.notifyError(error, "Não foi possível excluir o concurso.");
          }
        }
      })
    );

    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);

    return tr;
  }

  private renderEditableRow(contest: Contest, data: LeifPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-editing-row";

    const nameInput = DomHelpers.createTextarea("Nome", contest.name);
    nameInput.rows = 1;
    nameInput.className = "leif-textarea leif-textarea-inline";
    const notesInput = DomHelpers.createTextarea("Notas", contest.wall.notes ?? "");
    notesInput.rows = 2;
    notesInput.className = "leif-textarea leif-textarea-inline leif-textarea-notes";

    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateContestUseCase.execute({
            contestId: contest.id,
            name: nameInput.value,
            notes: notesInput.value
          });
          this.editingContestId = null;
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "Não foi possível salvar.");
        }
      }
    });

    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingContestId = null;
        await this.onUpdate();
      }
    });

    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);

    tr.appendChild(DomHelpers.createCell(null, nameInput));
    tr.appendChild(DomHelpers.createCell(contest.id));
    tr.appendChild(DomHelpers.createCell(null, notesInput));
    tr.appendChild(DomHelpers.createCell(data.activeContestId === contest.id ? "Ativo" : "Inativo"));

    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);

    return tr;
  }

  private openCreateContestModal(): void {
    const idInput = DomHelpers.createInput("text", "ID do concurso");
    const nameInput = DomHelpers.createInput("text", "Nome do concurso");

    const form = DomHelpers.createForm(async () => {
      try {
        await this.createContestUseCase.execute({
          id: idInput.value.trim(),
          name: nameInput.value.trim()
        });
        modal.close();
        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "Não foi possível criar o concurso.");
      }
    });

    form.append(
      DomHelpers.createLabel("ID", idInput),
      DomHelpers.createLabel("Nome", nameInput)
    );

    const modal = DomHelpers.createModal({
      title: "Novo concurso",
      content: form,
      onSubmit: () => form.requestSubmit()
    });

    modal.open();
  }

  private notifyError(error: unknown, fallbackMessage: string): void {
    new Notice(error instanceof Error ? error.message : fallbackMessage);
  }
}
