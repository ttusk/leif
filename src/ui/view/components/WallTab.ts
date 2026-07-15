import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { UpdateContestWallUseCase } from "@/application/use-cases/UpdateContestWallUseCase";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { wallLinkKey } from "@/domain/entities/Wall";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";

/**
 * Wall tab component with unified layout.
 */
export class WallTab {
  private readonly updateContestWallUseCase: UpdateContestWallUseCase;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    this.updateContestWallUseCase = new UpdateContestWallUseCase(dataStore, new EntityRepositoryFactory(dataStore));
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Mural"));
    container.appendChild(
      DomHelpers.createParagraph("Guarde links oficiais e anotações úteis do concurso ativo.")
    );

    const activeContest =
      data.contests.find((contest) => contest.id === data.activeContestId) ?? null;

    if (!activeContest) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Sem concurso escolhido",
          "Escolha um concurso para guardar links e notas."
        )
      );
      return;
    }

    container.appendChild(this.renderWallForm(activeContest));
    container.appendChild(this.renderSnapshotsCard(activeContest, data));
  }

  private renderWallForm(activeContest: NonNullable<LeifPluginData["contests"][number]>): HTMLElement {
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
    notes.rows = 8;
    notes.classList.add("leif-wall-notes");

    const form = DomHelpers.createForm(async () => {
      try {
        const noticeLink = noticeUrl.value
          ? [
              {
                id: wallLinkKey(activeContest.id, "notice"),
                label: noticeLabel.value || "Edital",
                url: noticeUrl.value
              }
            ]
          : [];

        const examLink = examUrl.value
          ? [
              {
                id: wallLinkKey(activeContest.id, "exam"),
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
        DomHelpers.notifyError(error, "Não consegui salvar o mural.");
      }
    });

    form.classList.add("leif-wall-form");

    const notesCard = DomHelpers.createElement("section", "leif-wall-card leif-wall-primary");
    notesCard.append(
      DomHelpers.createSectionSubtitle("Notas"),
      DomHelpers.createParagraph("Use este espaço para pesos, datas, cortes, estratégia e qualquer lembrete que você queira revisar sem procurar em outro lugar."),
      DomHelpers.createStackedLabel("Notas", notes)
    );

    const noticeCard = DomHelpers.createElement("section", "leif-wall-card");
    noticeCard.append(
      DomHelpers.createSectionSubtitle("Edital"),
      DomHelpers.createParagraph("Guarde o link do edital ou da página oficial do concurso."),
      DomHelpers.createLabel("Nome", noticeLabel),
      DomHelpers.createLabel("Link", noticeUrl)
    );

    const examCard = DomHelpers.createElement("section", "leif-wall-card");
    examCard.append(
      DomHelpers.createSectionSubtitle("Prova"),
      DomHelpers.createParagraph("Deixe aqui a prova anterior, o espelho ou outro material de referência."),
      DomHelpers.createLabel("Nome", examLabel),
      DomHelpers.createLabel("Link", examUrl)
    );

    const referenceGrid = DomHelpers.createElement("div", "leif-wall-reference-grid");
    referenceGrid.append(noticeCard, examCard);

    form.append(notesCard, referenceGrid);

    form.append(
      DomHelpers.createButton("Salvar mural", {
        type: "submit",
        className: "mod-cta leif-wall-save"
      })
    );

    return form;
  }

  private renderSnapshotsCard(
    activeContest: NonNullable<LeifPluginData["contests"][number]>,
    data: LeifPluginData
  ): HTMLElement {
    const card = DomHelpers.createCard("Resumo das matérias");
    if (activeContest.wall.subjectSnapshots.length === 0) {
      card.appendChild(
        DomHelpers.createParagraph("Ainda não há resumo salvo para as matérias.")
      );
    } else {
      const subjectMap = new Map(data.subjects.map((s) => [s.id, s.name]));
      const itemMap = new Map(data.studyItems.map((item) => [item.id, item.title]));
      card.appendChild(
        DomHelpers.createTable(
          ["Matéria", "Peso", "Pontuação", "Itens alvo"],
          activeContest.wall.subjectSnapshots.map((snapshot) => [
            subjectMap.get(snapshot.subjectId) ?? snapshot.subjectId,
            snapshot.weight !== undefined ? String(snapshot.weight) : "—",
            snapshot.score !== undefined ? String(snapshot.score) : "—",
            snapshot.targetItems?.map((itemId) => itemMap.get(itemId) ?? itemId).join(", ") ?? "—"
          ])
        )
      );
    }
    return card;
  }
}
