import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { DeleteContestUseCase } from "@/application/use-cases/DeleteContestUseCase";
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import { UpdateContestUseCase } from "@/application/use-cases/UpdateContestUseCase";
import { createLeifId } from "@/application/Id";
import type { Contest } from "@/domain/entities/Contest";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { ConfirmationModal } from "@/ui/confirmation/ConfirmationModal";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import type { App } from "obsidian";

export class ContestsTab {
  private readonly createContest: CreateContestUseCase;
  private readonly setActiveContest: SetActiveContestUseCase;
  private readonly updateContest: UpdateContestUseCase;
  private readonly deleteContest: DeleteContestUseCase;
  private editingContestId: string | null = null;

  constructor(
    private readonly app: App,
    dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const factory = new EntityRepositoryFactory(dataStore);
    this.createContest = new CreateContestUseCase(dataStore, factory);
    this.setActiveContest = new SetActiveContestUseCase(dataStore, factory);
    this.updateContest = new UpdateContestUseCase(dataStore, factory);
    this.deleteContest = new DeleteContestUseCase(dataStore);
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Concursos"));
    container.appendChild(this.renderCreateForm());

    const list = DomHelpers.createCard("Seus concursos");
    const { container: table, tbody } = DomHelpers.createCrudTable(["Concurso", "Status", "Ações"]);
    data.contests.forEach((contest) => {
      tbody.appendChild(
        this.editingContestId === contest.id
          ? this.renderEditableRow(contest, contest.id === data.activeContestId)
          : this.renderDisplayRow(contest, contest.id === data.activeContestId)
      );
    });
    list.appendChild(table);
    container.appendChild(list);
  }

  private renderDisplayRow(contest: Contest, isActive: boolean): HTMLTableRowElement {
    const row = DomHelpers.createElement("tr");
    row.dataset.contestId = contest.id;
    const name = DomHelpers.createStrong(contest.name);
    const status = DomHelpers.createBadge(isActive ? "Ativo" : "Guardado");
    const actions = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    actions.appendChild(
      DomHelpers.createMenuButton(
        [
          {
            label: "Ativar",
            icon: "check",
            disabled: isActive,
            onClick: async () => {
              await this.setActiveContest.execute({ contestId: contest.id });
              await this.onUpdate();
            }
          },
          {
            label: "Editar",
            icon: "edit",
            onClick: async () => {
              this.editingContestId = contest.id;
              await this.onUpdate();
            }
          },
          {
            label: "Excluir",
            icon: "trash-2",
            onClick: async () => {
              const confirmed = await ConfirmationModal.ask(this.app, {
                title: "Excluir concurso?",
                message: `O concurso "${contest.name}" e todo o seu conteúdo de estudo serão excluídos.`,
                confirmLabel: "Excluir concurso"
              });
              if (!confirmed) return;
              await this.deleteContest.execute({ contestId: contest.id });
              await this.onUpdate();
            }
          }
        ],
        `Ações de ${contest.name}`
      )
    );
    row.append(
      DomHelpers.createNameCell(null, name),
      DomHelpers.createStatusCell(status),
      DomHelpers.createActionsCell(actions)
    );
    return row;
  }

  private renderEditableRow(contest: Contest, isActive: boolean): HTMLTableRowElement {
    const row = DomHelpers.createElement("tr", "leif-editing-row");
    row.dataset.contestId = contest.id;
    const name = DomHelpers.createInput("text", "Nome", contest.name);
    name.dataset.contestEditorName = "true";
    const actions = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    actions.append(
      DomHelpers.createIconButton("save", "Salvar", {
        dataset: { contestEditorSave: "true" },
        onClick: async () => {
          await this.updateContest.execute({ contestId: contest.id, name: name.value });
          this.editingContestId = null;
          await this.onUpdate();
        }
      }),
      DomHelpers.createIconButton("cancel", "Cancelar", {
        dataset: { contestEditorCancel: "true" },
        onClick: async () => {
          this.editingContestId = null;
          await this.onUpdate();
        }
      })
    );
    row.append(
      DomHelpers.createNameCell(null, name),
      DomHelpers.createStatusCell(DomHelpers.createBadge(isActive ? "Ativo" : "Guardado")),
      DomHelpers.createActionsCell(actions)
    );
    return row;
  }

  private renderCreateForm(): HTMLElement {
    const form = DomHelpers.createCard("Novo concurso");
    const input = DomHelpers.createInput("text", "Nome do concurso");
    form.append(
      DomHelpers.createStackedLabel("Nome", input),
      DomHelpers.createButton("Criar", {
        onClick: async () => {
          await this.createContest.execute({ id: createLeifId(), name: input.value });
          await this.onUpdate();
        }
      })
    );
    return form;
  }
}
