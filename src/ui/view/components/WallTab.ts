import { Component, MarkdownRenderer, type App } from "obsidian";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { UpdateContestMuralUseCase } from "@/application/use-cases/UpdateContestMuralUseCase";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";

/**
 * Mural tab — renders `mural.md` content with Obsidian's MarkdownRenderer in
 * read mode and offers an explicit edit mode that patches only the free-form
 * notes while preserving all other user Markdown on save.
 */
export class WallTab {
  private readonly updateMural: UpdateContestMuralUseCase;
  private editing = false;

  constructor(
    private readonly app: App,
    dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    this.updateMural = new UpdateContestMuralUseCase(
      dataStore,
      new EntityRepositoryFactory(dataStore)
    );
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Mural"));
    const contest = data.contests.find((entry) => entry.id === data.activeContestId);
    if (!contest) {
      container.appendChild(
        DomHelpers.createEmptyState("Sem concurso ativo", "Escolha um concurso.")
      );
      return;
    }
    if (this.editing) {
      container.appendChild(this.renderEditor(contest.id, contest.mural.notes ?? ""));
      return;
    }
    container.appendChild(await this.renderReadView(contest.mural.notes ?? ""));
  }

  private async renderReadView(notes: string): Promise<HTMLElement> {
    const readView = DomHelpers.createElement("div", "leif-wall-read-view");
    const notesSection = DomHelpers.createElement(
      "section",
      "leif-wall-section leif-wall-notes-section"
    );
    const notesHeading = DomHelpers.createElement("h3", "leif-section-subtitle");
    notesHeading.textContent = "Notas";
    const notesBody = DomHelpers.createElement("div", "leif-wall-notes-content");
    await MarkdownRenderer.render(this.app, notes, notesBody, "", new Component());
    notesSection.append(notesHeading, notesBody);
    const actions = DomHelpers.createElement("div", "leif-form-actions");
    actions.appendChild(
      DomHelpers.createButton("Editar mural", {
        dataset: { wallEdit: "true" },
        onClick: async () => {
          this.editing = true;
          await this.onUpdate();
        }
      })
    );
    readView.append(notesSection, actions);
    return readView;
  }

  private renderEditor(contestId: string, notes: string): HTMLElement {
    const editor = DomHelpers.createElement("section", "leif-wall-editor");
    const heading = DomHelpers.createSectionSubtitle("Editar mural");
    const textarea = DomHelpers.createTextarea("Notas do mural", notes);
    textarea.rows = 12;
    textarea.dataset.wallNotes = "true";
    const actions = DomHelpers.createElement("div", "leif-form-actions");
    actions.append(
      DomHelpers.createButton("Cancelar", {
        dataset: { wallCancel: "true" },
        onClick: async () => {
          this.editing = false;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Salvar", {
        dataset: { wallSave: "true" },
        className: "mod-cta",
        onClick: async () => {
          await this.updateMural.execute({ contestId, notes: textarea.value });
          this.editing = false;
          await this.onUpdate();
        }
      })
    );
    editor.append(heading, textarea, actions);
    return editor;
  }
}
