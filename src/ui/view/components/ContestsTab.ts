import { Notice } from "obsidian";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { DeleteContestUseCase } from "@/application/use-cases/DeleteContestUseCase";
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import { UpdateContestUseCase } from "@/application/use-cases/UpdateContestUseCase";
import type { Contest } from "@/domain/entities/Contest";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";

/**
 * Contests tab component with unified CRUD pattern.
 */
export class ContestsTab {
  private readonly createContestUseCase: CreateContestUseCase;
  private readonly setActiveContestUseCase: SetActiveContestUseCase;
  private readonly updateContestUseCase: UpdateContestUseCase;
  private readonly deleteContestUseCase: DeleteContestUseCase;

  private editingContestId: string | null = null;
  private isCreatingContest = false;
  private pendingDeleteContestId: string | null = null;

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
        onClick: async () => {
          this.isCreatingContest = true;
          await this.onUpdate();
        }
      })
    );
    container.appendChild(header);

    if (this.isCreatingContest) {
      container.appendChild(this.renderCreateContestForm());
    }

    const contestsCard = DomHelpers.createCard("Seus concursos");
    if (data.contests.length === 0) {
      contestsCard.appendChild(DomHelpers.createParagraph("Nenhum concurso por aqui ainda."));
    }

    const list = DomHelpers.createElement("div", "leif-contest-list");

    data.contests.forEach((contest) => {
      const isEditing = this.editingContestId === contest.id;
      if (isEditing) {
        list.appendChild(this.renderEditableCard(contest, data));
      } else {
        list.appendChild(this.renderDisplayCard(contest, data));
      }
    });

    contestsCard.appendChild(list);
    container.appendChild(contestsCard);
  }

  private renderDisplayCard(contest: Contest, data: LeifPluginData): HTMLElement {
    const card = DomHelpers.createElement("section", "leif-contest-card");
    card.dataset.contestCardId = contest.id;
    const isActive = data.activeContestId === contest.id;

    const actions = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    const secondaryActions: HTMLElement[] = [];

    if (!isActive) {
      actions.appendChild(
        DomHelpers.createIconButton("toggleOn", "Ativar", {
          dataset: { contestId: contest.id },
          onClick: async () => {
            try {
              await this.setActiveContestUseCase.execute({ contestId: contest.id });
              new Notice(`${contest.name} agora é o concurso ativo.`);
              await this.onUpdate();
            } catch (error) {
              DomHelpers.notifyError(error, "Não consegui escolher esse concurso.");
            }
          }
        })
      );
    }

    secondaryActions.push(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingContestId = contest.id;
          await this.onUpdate();
        }
      })
    );

    secondaryActions.push(
      DomHelpers.createIconButton("delete", "Excluir", {
        onClick: async () => {
          this.pendingDeleteContestId = contest.id;
          await this.onUpdate();
        }
      })
    );

    if (this.pendingDeleteContestId === contest.id) {
      secondaryActions.push(
        DomHelpers.createButton("Excluir?", {
          dataset: { contestDeleteId: contest.id },
          onClick: async () => {
            try {
              await this.deleteContestUseCase.execute({ contestId: contest.id });
              this.pendingDeleteContestId = null;
              await this.onUpdate();
            } catch (error) {
              DomHelpers.notifyError(error, "Não consegui excluir esse concurso.");
            }
          }
        }),
        DomHelpers.createButton("Cancelar", {
          onClick: async () => {
            this.pendingDeleteContestId = null;
            await this.onUpdate();
          }
        })
      );
    }
    actions.appendChild(DomHelpers.createOverflowMenu(secondaryActions));

    const header = DomHelpers.createElement("div", "leif-contest-card-header");
    const titleGroup = DomHelpers.createElement("div", "leif-contest-card-title-group");
    const title = DomHelpers.createElement("strong", "leif-contest-card-title");
    title.textContent = contest.name;
    const status = DomHelpers.createElement(
      "span",
      isActive ? "leif-status-active" : "leif-status-inactive"
    );
    status.textContent = isActive ? "Estudando agora" : "Guardado";
    titleGroup.append(title, status);
    header.append(titleGroup, actions);

    const notes = DomHelpers.createParagraph(contest.wall.notes?.trim() || "Sem notas ainda.");
    notes.classList.add("leif-contest-notes");
    const meta = DomHelpers.createElement("div", "leif-contest-meta");
    if (contest.examPlan?.examDate) {
      meta.append(DomHelpers.createMetric("Prova", contest.examPlan.examDate));
    }
    if (contest.examPlan?.board) {
      meta.append(DomHelpers.createMetric("Banca", contest.examPlan.board));
    }
    if (contest.examPlan?.weeklyStudyHours !== undefined) {
      meta.append(
        DomHelpers.createMetric("Carga", `${contest.examPlan.weeklyStudyHours} h/semana`)
      );
    }
    if (contest.examPlan?.weeklyQuestionGoal !== undefined) {
      meta.append(
        DomHelpers.createMetric("Meta", `${contest.examPlan.weeklyQuestionGoal} questões/semana`)
      );
    }
    if (meta.childElementCount === 0) {
      meta.append(DomHelpers.createMetric("Planejamento", "Sem dados de prova"));
    }

    card.append(header, meta, notes);
    return card;
  }

  private renderEditableCard(contest: Contest, data: LeifPluginData): HTMLElement {
    const card = DomHelpers.createElement("section", "leif-contest-card is-editing");
    card.dataset.contestCardId = contest.id;

    const nameInput = DomHelpers.createInput("text", "Nome do concurso", contest.name);
    const notesInput = DomHelpers.createTextarea("Notas do concurso", contest.wall.notes ?? "");
    const examDateInput = DomHelpers.createInput(
      "date",
      "Data da prova",
      contest.examPlan?.examDate ?? ""
    );
    const boardInput = DomHelpers.createInput("text", "Banca", contest.examPlan?.board ?? "");
    const weeklyStudyHoursInput = DomHelpers.createInput(
      "number",
      "Horas por semana",
      contest.examPlan?.weeklyStudyHours !== undefined
        ? String(contest.examPlan.weeklyStudyHours)
        : ""
    );
    const weeklyQuestionGoalInput = DomHelpers.createInput(
      "number",
      "Questões por semana",
      contest.examPlan?.weeklyQuestionGoal !== undefined
        ? String(contest.examPlan.weeklyQuestionGoal)
        : ""
    );
    notesInput.rows = 4;

    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateContestUseCase.execute({
            contestId: contest.id,
            name: nameInput.value,
            notes: notesInput.value,
            examPlan: {
              examDate: examDateInput.value,
              board: boardInput.value,
              weeklyStudyHours: this.readOptionalNumber(weeklyStudyHoursInput.value),
              weeklyQuestionGoal: this.readOptionalNumber(weeklyQuestionGoalInput.value)
            }
          });
          this.editingContestId = null;
          await this.onUpdate();
        } catch (error) {
          DomHelpers.notifyError(error, "Não consegui salvar.");
        }
      }
    });

    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingContestId = null;
        await this.onUpdate();
      }
    });

    const actions = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);

    const fields = DomHelpers.createElement("div", "leif-contest-edit-form");
    fields.append(
      DomHelpers.createStackedLabel("Nome", nameInput),
      DomHelpers.createStackedLabel("Notas", notesInput),
      DomHelpers.createStackedLabel("Data da prova", examDateInput),
      DomHelpers.createStackedLabel("Banca", boardInput),
      DomHelpers.createStackedLabel("Horas por semana", weeklyStudyHoursInput),
      DomHelpers.createStackedLabel("Questões por semana", weeklyQuestionGoalInput)
    );

    const status = DomHelpers.createElement(
      "span",
      data.activeContestId === contest.id ? "leif-status-active" : "leif-status-inactive"
    );
    status.textContent = data.activeContestId === contest.id ? "Estudando agora" : "Guardado";

    card.append(DomHelpers.createSectionSubtitle("Editar concurso"), fields, status, actions);

    return card;
  }

  private renderCreateContestForm(): HTMLElement {
    const idInput = DomHelpers.createInput("text", "ID do concurso");
    const nameInput = DomHelpers.createInput("text", "Nome do concurso");

    const form = DomHelpers.createForm(async () => {
      try {
        await this.createContestUseCase.execute({
          id: idInput.value.trim(),
          name: nameInput.value.trim()
        });
        this.isCreatingContest = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não consegui criar esse concurso.");
      }
    });

    form.classList.add("leif-card");
    form.append(
      DomHelpers.createSectionSubtitle("Novo concurso"),
      DomHelpers.createLabel("ID", idInput),
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createElement("div", "leif-form-actions")
    );

    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isCreatingContest = false;
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

  private readOptionalNumber(value: string): number | undefined {
    if (!value.trim()) {
      return undefined;
    }
    return Number(value);
  }
}
