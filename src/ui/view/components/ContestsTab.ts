import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { DeleteContestUseCase } from "@/application/use-cases/DeleteContestUseCase";
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import { UpdateContestMuralUseCase } from "@/application/use-cases/UpdateContestMuralUseCase";
import { UpdateContestUseCase } from "@/application/use-cases/UpdateContestUseCase";
import { createLeifId } from "@/application/Id";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";

export class ContestsTab {
  private readonly createContest: CreateContestUseCase;
  private readonly setActiveContest: SetActiveContestUseCase;
  private readonly updateContest: UpdateContestUseCase;
  private readonly updateMural: UpdateContestMuralUseCase;
  private readonly deleteContest: DeleteContestUseCase;

  constructor(
    dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const factory = new EntityRepositoryFactory(dataStore);
    this.createContest = new CreateContestUseCase(dataStore, factory);
    this.setActiveContest = new SetActiveContestUseCase(dataStore, factory);
    this.updateContest = new UpdateContestUseCase(dataStore, factory);
    this.updateMural = new UpdateContestMuralUseCase(dataStore, factory);
    this.deleteContest = new DeleteContestUseCase(dataStore);
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Concursos"));
    container.appendChild(this.renderCreateForm());

    const list = DomHelpers.createCard("Seus concursos");
    data.contests.forEach((contest) => {
      const row = DomHelpers.createElement("section", "leif-contest-card");
      const title = DomHelpers.createStrong(contest.name);
      const status = DomHelpers.createBadge(
        contest.id === data.activeContestId ? "Ativo" : "Guardado"
      );
      const nameInput = DomHelpers.createInput("text", "Nome", contest.name);
      const notesInput = DomHelpers.createTextarea("Notas", contest.mural.notes ?? "");
      notesInput.rows = 3;
      const actions = DomHelpers.createElement("div", "leif-inline-actions");
      actions.append(
        DomHelpers.createButton("Ativar", {
          onClick: async () => {
            await this.setActiveContest.execute({ contestId: contest.id });
            await this.onUpdate();
          }
        }),
        DomHelpers.createButton("Salvar", {
          onClick: async () => {
            await this.updateContest.execute({ contestId: contest.id, name: nameInput.value });
            await this.updateMural.execute({ contestId: contest.id, notes: notesInput.value });
            await this.onUpdate();
          }
        }),
        DomHelpers.createButton("Excluir", {
          onClick: async () => {
            await this.deleteContest.execute({ contestId: contest.id });
            await this.onUpdate();
          }
        })
      );
      row.append(
        title,
        status,
        DomHelpers.createStackedLabel("Nome", nameInput),
        DomHelpers.createStackedLabel("Mural", notesInput),
        actions
      );
      list.appendChild(row);
    });
    container.appendChild(list);
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
