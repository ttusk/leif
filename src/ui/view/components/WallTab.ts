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
  private isEditing = false;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    this.updateContestWallUseCase = new UpdateContestWallUseCase(
      dataStore,
      new EntityRepositoryFactory(dataStore)
    );
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Mural"));

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

    const hasContent = Boolean(
      activeContest.wall.noticeLinks.length ||
        activeContest.wall.examLinks.length ||
        activeContest.wall.notes?.trim()
    );
    if (!hasContent) {
      this.isEditing = true;
    }

    container.appendChild(
      this.isEditing ? this.renderWallEditor(activeContest) : this.renderWallReadView(activeContest)
    );
    container.appendChild(this.renderSnapshotsCard(activeContest, data));
  }

  private renderWallReadView(
    activeContest: NonNullable<LeifPluginData["contests"][number]>
  ): HTMLElement {
    const view = DomHelpers.createElement("div", "leif-wall-read-view");
    const actions = DomHelpers.createElement("div", "leif-section-actions");
    actions.appendChild(
      DomHelpers.createButton("Editar", {
        onClick: async () => {
          this.isEditing = true;
          await this.onUpdate();
        }
      })
    );
    view.appendChild(actions);
    view.append(
      this.renderLinkSection("Edital", activeContest.wall.noticeLinks[0]),
      this.renderLinkSection("Prova", activeContest.wall.examLinks[0]),
      this.renderNotesSection(activeContest.wall.notes)
    );
    return view;
  }

  private renderLinkSection(
    title: string,
    link?: { label: string; url: string }
  ): HTMLElement {
    const section = DomHelpers.createElement("section", "leif-wall-section");
    section.appendChild(DomHelpers.createSectionSubtitle(title));
    if (!link) {
      section.appendChild(DomHelpers.createParagraph("Nenhum link salvo."));
      return section;
    }

    const anchor = DomHelpers.createElement("a", "leif-wall-link");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.textContent = link.label;
    const url = DomHelpers.createElement("span", "leif-wall-link-url");
    url.textContent = link.url;
    section.append(anchor, url);
    return section;
  }

  private renderNotesSection(notes?: string): HTMLElement {
    const section = DomHelpers.createElement("section", "leif-wall-section");
    section.appendChild(DomHelpers.createSectionSubtitle("Notas"));
    const body = DomHelpers.createElement("div", "leif-wall-notes-content");
    body.textContent = notes?.trim() || "Nenhuma nota salva.";
    section.appendChild(body);
    return section;
  }

  private renderWallEditor(
    activeContest: NonNullable<LeifPluginData["contests"][number]>
  ): HTMLElement {
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
    const notes = DomHelpers.createTextarea("Notas do concurso", activeContest.wall.notes ?? "");
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

        this.isEditing = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não consegui salvar o mural.");
      }
    });

    form.classList.add("leif-wall-editor", "is-editing");

    const noticeSection = DomHelpers.createElement("section", "leif-wall-editor-section");
    noticeSection.append(
      DomHelpers.createSectionSubtitle("Edital"),
      DomHelpers.createStackedLabel("Nome", noticeLabel),
      DomHelpers.createUrlField("Link", noticeUrl)
    );

    const examSection = DomHelpers.createElement("section", "leif-wall-editor-section");
    examSection.append(
      DomHelpers.createSectionSubtitle("Prova"),
      DomHelpers.createStackedLabel("Nome", examLabel),
      DomHelpers.createUrlField("Link", examUrl)
    );

    const notesSection = DomHelpers.createElement("section", "leif-wall-editor-section");
    notesSection.append(
      DomHelpers.createSectionSubtitle("Notas"),
      DomHelpers.createStackedLabel("Notas", notes)
    );

    const actions = DomHelpers.createElement("div", "leif-form-actions");
    actions.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isEditing = false;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Salvar alterações", {
        type: "submit",
        className: "mod-cta"
      })
    );

    form.append(noticeSection, examSection, notesSection, actions);

    return form;
  }

  private renderSnapshotsCard(
    activeContest: NonNullable<LeifPluginData["contests"][number]>,
    data: LeifPluginData
  ): HTMLElement {
    const card = DomHelpers.createCard("Resumo das matérias");
    if (activeContest.wall.subjectSnapshots.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Ainda não há resumo salvo para as matérias."));
    } else {
      const subjectMap = new Map(data.subjects.map((s) => [s.id, s.name]));
      const itemMap = new Map(data.studyItems.map((item) => [item.id, item.title]));
      const list = DomHelpers.createElement("div", "leif-wall-snapshot-list");
      activeContest.wall.subjectSnapshots.forEach((snapshot) => {
        const row = DomHelpers.createElement("section", "leif-wall-snapshot-card");
        const titleGroup = DomHelpers.createElement("div", "leif-wall-snapshot-title-group");
        const title = DomHelpers.createElement("strong", "leif-wall-snapshot-title");
        title.textContent = subjectMap.get(snapshot.subjectId) ?? snapshot.subjectId;
        titleGroup.appendChild(title);

        const metrics = DomHelpers.createElement("div", "leif-wall-snapshot-meta");
        metrics.append(
          DomHelpers.createMetric(
            "Peso",
            snapshot.weight !== undefined ? String(snapshot.weight) : "—"
          ),
          DomHelpers.createMetric(
            "Pontuação",
            snapshot.score !== undefined ? String(snapshot.score) : "—"
          ),
          DomHelpers.createMetric(
            "Itens alvo",
            snapshot.targetItems?.map((itemId) => itemMap.get(itemId) ?? itemId).join(", ") ?? "—"
          )
        );

        row.append(titleGroup, metrics);
        list.appendChild(row);
      });
      card.appendChild(list);
    }
    return card;
  }
}
