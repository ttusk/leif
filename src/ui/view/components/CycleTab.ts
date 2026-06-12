import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { ListSubjectsForActiveContestUseCase } from "@/application/use-cases/ListSubjectsForActiveContestUseCase";
import { ReorderSubjectsUseCase } from "@/application/use-cases/ReorderSubjectsUseCase";
import { SetSubjectActiveStateUseCase } from "@/application/use-cases/SetSubjectActiveStateUseCase";
import { UpdateSubjectConfigurationUseCase } from "@/application/use-cases/UpdateSubjectConfigurationUseCase";
import { NoActiveContestError } from "@/domain/errors/DomainErrors";
import type { CorvoPluginData } from "@/domain/types/CorvoPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { Notice } from "obsidian";

/**
 * Cycle tab component - manages subjects, order, status, time and stage.
 */
export class CycleTab {
  private readonly createSubjectUseCase: CreateSubjectUseCase;
  private readonly listSubjectsForActiveContestUseCase: ListSubjectsForActiveContestUseCase;
  private readonly reorderSubjectsUseCase: ReorderSubjectsUseCase;
  private readonly setSubjectActiveStateUseCase: SetSubjectActiveStateUseCase;
  private readonly updateSubjectConfigurationUseCase: UpdateSubjectConfigurationUseCase;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    this.createSubjectUseCase = new CreateSubjectUseCase(dataStore);
    this.listSubjectsForActiveContestUseCase = new ListSubjectsForActiveContestUseCase(dataStore);
    this.reorderSubjectsUseCase = new ReorderSubjectsUseCase(dataStore);
    this.setSubjectActiveStateUseCase = new SetSubjectActiveStateUseCase(dataStore);
    this.updateSubjectConfigurationUseCase = new UpdateSubjectConfigurationUseCase(dataStore);
  }

  /**
   * Renders the cycle tab content.
   */
  async render(container: HTMLElement, data: CorvoPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Ciclo e Matérias"));
    container.appendChild(
      DomHelpers.createParagraph("Gerencie a ordem, o status, o tempo e a etapa das matérias.")
    );
    container.appendChild(
      DomHelpers.createDisclosure("Nova matéria", this.renderCreateSubjectForm(data))
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

    card.appendChild(
      DomHelpers.createTable(
        ["Ordem", "Matéria", "Tempo", "Etapa", "Status", "Ações"],
        subjects.map((subject, index) => [
          String(subject.order),
          subject.name,
          `${subject.plannedStudyMinutes} min`,
          subject.currentStage ?? "Não definida",
          subject.isActive ? "Ativa" : "Inativa",
          this.renderSubjectActionsCell(subjects, subject, index, data.activeContestId)
        ])
      )
    );

    subjects.forEach((subject) => {
      card.appendChild(
        DomHelpers.createDisclosure(
          `Editar ${subject.name}`,
          this.renderSubjectConfigForm(subject)
        )
      );
    });

    container.appendChild(card);
  }

  private renderCreateSubjectForm(data: CorvoPluginData): HTMLElement {
    const activeContestId = data.activeContestId;
    const nameInput = DomHelpers.createInput("text", "Nome da matéria");
    const minutesInput = DomHelpers.createInput("number", "Minutos planejados", "60");

    const form = DomHelpers.createForm(async () => {
      try {
        if (!activeContestId) {
          throw new NoActiveContestError();
        }
        await this.createSubjectUseCase.execute({
          id: `${activeContestId}-subject-${Date.now()}`,
          contestId: activeContestId,
          name: nameInput.value,
          plannedStudyMinutes: Number(minutesInput.value)
        });
        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "Não foi possível criar a matéria.");
      }
    });

    form.append(
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createLabel("Minutos", minutesInput),
      DomHelpers.createButton("Criar matéria", { type: "submit", className: "corvo-primary-button" })
    );

    return form;
  }

  private renderSubjectActionsCell(
    subjects: Awaited<ReturnType<ListSubjectsForActiveContestUseCase["execute"]>>,
    subject: Awaited<ReturnType<ListSubjectsForActiveContestUseCase["execute"]>>[number],
    index: number,
    activeContestId: string | null
  ): HTMLElement {
    const controls = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");

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

    controls.appendChild(
      DomHelpers.createIconButton(
        subject.isActive ? "toggleOn" : "toggleOff",
        subject.isActive ? "Desativar" : "Ativar",
        {
          onClick: async () => {
            try {
              await this.setSubjectActiveStateUseCase.execute({
                subjectId: subject.id,
                isActive: !subject.isActive
              });
              await this.onUpdate();
            } catch (error) {
              this.notifyError(error, "Não foi possível alterar o status da matéria.");
            }
          }
        }
      )
    );

    return controls;
  }

  private renderSubjectConfigForm(
    subject: Awaited<ReturnType<ListSubjectsForActiveContestUseCase["execute"]>>[number]
  ): HTMLElement {
    const minutesInput = DomHelpers.createInput(
      "number",
      "Minutos",
      String(subject.plannedStudyMinutes)
    );
    const stageInput = DomHelpers.createInput("text", "Etapa", subject.currentStage ?? "");

    const configForm = DomHelpers.createForm(async () => {
      try {
        await this.updateSubjectConfigurationUseCase.execute({
          subjectId: subject.id,
          plannedStudyMinutes: Number(minutesInput.value),
          currentStage: stageInput.value
        });
        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "Não foi possível atualizar a configuração da matéria.");
      }
    });

    configForm.classList.add("corvo-form-compact");

    configForm.append(
      DomHelpers.createLabel("Minutos", minutesInput),
      DomHelpers.createLabel("Etapa", stageInput),
      DomHelpers.createButton("Salvar", { type: "submit", className: "corvo-primary-button" })
    );

    return configForm;
  }

  private async moveSubject(
    subjects: Awaited<ReturnType<ListSubjectsForActiveContestUseCase["execute"]>>,
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
      this.notifyError(error, "Não foi possível reordenar as matérias.");
    }
  }

  private notifyError(error: unknown, fallbackMessage: string): void {
    if (error instanceof NoActiveContestError) {
      new Notice("Nenhum concurso ativo. Selecione um concurso para continuar.");
      return;
    }
    new Notice(error instanceof Error ? error.message : fallbackMessage);
  }
}
