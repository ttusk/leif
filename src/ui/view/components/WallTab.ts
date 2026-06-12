import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { UpdateContestWallUseCase } from "@/application/use-cases/UpdateContestWallUseCase";
import { NoActiveContestError } from "@/domain/errors/DomainErrors";
import type { CorvoPluginData } from "@/domain/types/CorvoPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { Notice } from "obsidian";

/**
 * Wall tab component with unified layout.
 */
export class WallTab {
  private readonly updateContestWallUseCase: UpdateContestWallUseCase;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    this.updateContestWallUseCase = new UpdateContestWallUseCase(dataStore);
  }

  async render(container: HTMLElement, data: CorvoPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Mural"));
    container.appendChild(
      DomHelpers.createParagraph("Centralize os links e notas principais do concurso.")
    );

    const activeContest =
      data.contests.find((contest) => contest.id === data.activeContestId) ?? null;

    if (!activeContest) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Nenhum concurso ativo",
          "Selecione um concurso para editar o mural."
        )
      );
      return;
    }

    container.appendChild(this.renderWallForm(activeContest));
    container.appendChild(this.renderSnapshotsCard(activeContest, data));
  }

  private renderWallForm(activeContest: NonNullable<CorvoPluginData["contests"][number]>): HTMLElement {
    const noticeLabel = DomHelpers.createInput(
      "text",
      "Rótulo do edital",
      activeContest.wall.noticeLinks[0]?.label ?? ""
    );
    const noticeUrl = DomHelpers.createInput(
      "url",
      "URL do edital",
      activeContest.wall.noticeLinks[0]?.url ?? ""
    );
    const examLabel = DomHelpers.createInput(
      "text",
      "Rótulo da prova",
      activeContest.wall.examLinks[0]?.label ?? ""
    );
    const examUrl = DomHelpers.createInput(
      "url",
      "URL da prova",
      activeContest.wall.examLinks[0]?.url ?? ""
    );
    const notes = DomHelpers.createTextarea(
      "Notas do concurso",
      activeContest.wall.notes ?? ""
    );

    const form = DomHelpers.createForm(async () => {
      try {
        const noticeLink = noticeUrl.value
          ? [
              {
                id: `${activeContest.id}-notice`,
                label: noticeLabel.value || "Edital",
                url: noticeUrl.value
              }
            ]
          : [];

        const examLink = examUrl.value
          ? [
              {
                id: `${activeContest.id}-exam`,
                label: examLabel.value || "Prova",
                url: examUrl.value
              }
            ]
          : [];

        await this.updateContestWallUseCase.execute({
          contestId: activeContest.id,
          wall: {
            noticeLinks: noticeLink,
            examLinks: examLink,
            subjectSnapshots: activeContest.wall.subjectSnapshots,
            notes: notes.value
          }
        });

        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "Não foi possível salvar o mural.");
      }
    });

    form.classList.add("corvo-card");

    form.append(
      DomHelpers.createLabel("Edital", noticeLabel),
      DomHelpers.createLabel("Link do edital", noticeUrl),
      DomHelpers.createLabel("Prova", examLabel),
      DomHelpers.createLabel("Link da prova", examUrl),
      DomHelpers.createLabel("Notas", notes),
      DomHelpers.createButton("Salvar mural", {
        type: "submit",
        className: "corvo-primary-button"
      })
    );

    return form;
  }

  private renderSnapshotsCard(
    activeContest: NonNullable<CorvoPluginData["contests"][number]>,
    data: CorvoPluginData
  ): HTMLElement {
    const card = DomHelpers.createCard("Snapshots das matérias");
    if (activeContest.wall.subjectSnapshots.length === 0) {
      card.appendChild(
        DomHelpers.createParagraph("Nenhum snapshot de matéria cadastrado.")
      );
    } else {
      const subjectMap = new Map(data.subjects.map((s) => [s.id, s.name]));
      card.appendChild(
        DomHelpers.createTable(
          ["Matéria", "Peso", "Pontuação", "Itens alvo"],
          activeContest.wall.subjectSnapshots.map((snapshot) => [
            subjectMap.get(snapshot.subjectId) ?? snapshot.subjectId,
            snapshot.weight !== undefined ? String(snapshot.weight) : "—",
            snapshot.score !== undefined ? String(snapshot.score) : "—",
            snapshot.targetItems?.join(", ") ?? "—"
          ])
        )
      );
    }
    return card;
  }

  private notifyError(error: unknown, fallbackMessage: string): void {
    if (error instanceof NoActiveContestError) {
      new Notice("Nenhum concurso ativo. Selecione um concurso para continuar.");
      return;
    }
    new Notice(error instanceof Error ? error.message : fallbackMessage);
  }
}
