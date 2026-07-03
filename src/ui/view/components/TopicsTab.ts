import { Notice } from "obsidian";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateTopicUseCase } from "@/application/use-cases/CreateTopicUseCase";
import { DeleteTopicUseCase } from "@/application/use-cases/DeleteTopicUseCase";
import { LinkQuestionNotebookUseCase } from "@/application/use-cases/LinkQuestionNotebookUseCase";
import { UpdateTopicUseCase } from "@/application/use-cases/UpdateTopicUseCase";
import type { Topic } from "@/domain/entities/Topic";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";

/**
 * Topics tab component with unified CRUD pattern.
 * Table with inline editing + expandable detail rows for question notebooks.
 */
export class TopicsTab {
  private readonly createTopicUseCase: CreateTopicUseCase;
  private readonly linkQuestionNotebookUseCase: LinkQuestionNotebookUseCase;
  private readonly deleteTopicUseCase: DeleteTopicUseCase;
  private readonly updateTopicUseCase: UpdateTopicUseCase;

  private selectedSubjectId: string | null = null;
  private editingTopicId: string | null = null;
  private expandedTopicId: string | null = null;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.createTopicUseCase = new CreateTopicUseCase(dataStore, repositoryFactory);
    this.deleteTopicUseCase = new DeleteTopicUseCase(dataStore, repositoryFactory);
    this.linkQuestionNotebookUseCase = new LinkQuestionNotebookUseCase(dataStore, repositoryFactory);
    this.updateTopicUseCase = new UpdateTopicUseCase(dataStore, repositoryFactory);
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Assuntos e Questões"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Novo assunto", {
        onClick: () => this.openCreateTopicModal(this.getSelectedSubject(data)?.id ?? "")
      })
    );
    container.appendChild(header);

    const subject = this.getSelectedSubject(data);
    if (!subject) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Nenhuma matéria selecionada",
          "Cadastre matérias no concurso ativo."
        )
      );
      return;
    }

    container.appendChild(this.renderSubjectPicker(data));

    const topics = data.topics
      .filter((topic) => topic.subjectId === subject.id);

    const card = DomHelpers.createCard(`Assuntos de ${subject.name}`);

    if (topics.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Nenhum assunto cadastrado."));
      container.appendChild(card);
      return;
    }

    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Assunto",
      "Caderno",
      "Resolv.",
      "Acert.",
      "Ações"
    ]);

    topics.forEach((topic) => {
      const isEditing = this.editingTopicId === topic.id;
      const isExpanded = this.expandedTopicId === topic.id;

      if (isEditing) {
        tbody.appendChild(this.renderEditableRow(topic, data));
      } else {
        tbody.appendChild(this.renderDisplayRow(topic, data));
      }

      if (isExpanded && !isEditing) {
        tbody.appendChild(this.renderDetailRow(topic, data));
      }
    });

    card.appendChild(tableContainer);
    container.appendChild(card);
  }

  private renderDisplayRow(topic: Topic, data: LeifPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.topicId = topic.id;
    const hasDetails = Boolean(topic.questionNotebook);

    tr.appendChild(DomHelpers.createCell(topic.name));
    tr.appendChild(DomHelpers.createCell(null, this.renderNotebookCell(topic)));
    tr.appendChild(DomHelpers.createCell(String(topic.questionNotebook?.solvedQuestions ?? 0)));
    tr.appendChild(DomHelpers.createCell(String(topic.questionNotebook?.correctAnswers ?? 0)));

    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(
      DomHelpers.createIconButton(
        this.expandedTopicId === topic.id ? "collapse" : "expand",
        this.expandedTopicId === topic.id ? "Recolher" : "Expandir",
        {
          className: `leif-icon-button ${hasDetails ? "" : "leif-expand-button"}`,
          onClick: async () => {
            this.expandedTopicId = this.expandedTopicId === topic.id ? null : topic.id;
            await this.onUpdate();
          }
        }
      )
    );
    actions.appendChild(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingTopicId = topic.id;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("delete", "Excluir", {
        onClick: async () => {
          const confirmed = await DomHelpers.confirm({
            title: "Excluir assunto",
            message: `Excluir "${topic.name}"?`,
            confirmLabel: "Excluir"
          });
          if (!confirmed) return;
          try {
            await this.deleteTopicUseCase.execute({ topicId: topic.id });
            await this.onUpdate();
          } catch (error) {
            this.notifyError(error, "Não foi possível excluir o assunto.");
          }
        }
      })
    );

    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);

    return tr;
  }

  private renderNotebookCell(topic: Topic): HTMLElement {
    const notebook = topic.questionNotebook;

    if (!notebook) {
      return DomHelpers.createParagraph("—");
    }

    if (!notebook.url) {
      return DomHelpers.createParagraph(notebook.name);
    }

    const link = DomHelpers.createElement("a");
    link.href = notebook.url;
    link.textContent = notebook.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.dataset.topicNotebookUrl = topic.id;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.open(notebook.url, "_blank", "noopener");
    });

    return link;
  }

  private renderEditableRow(topic: Topic, data: LeifPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-editing-row";
    tr.dataset.topicId = topic.id;

    const nameInput = DomHelpers.createCompactInput("text", "Nome", topic.name);
    const solvedInput = DomHelpers.createCompactInput(
      "number",
      "Resolv.",
      String(topic.questionNotebook?.solvedQuestions ?? 0)
    );
    const correctInput = DomHelpers.createCompactInput(
      "number",
      "Acert.",
      String(topic.questionNotebook?.correctAnswers ?? 0)
    );

    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateTopicUseCase.execute({
            topicId: topic.id,
            name: nameInput.value,
            questionNotebook: topic.questionNotebook
              ? {
                  id: topic.questionNotebook.id,
                  name: topic.questionNotebook.name,
                  url: topic.questionNotebook.url,
                  solvedQuestions: Number(solvedInput.value),
                  correctAnswers: Number(correctInput.value)
                }
              : undefined
          });
          this.editingTopicId = null;
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "Não foi possível salvar.");
        }
      }
    });

    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingTopicId = null;
        await this.onUpdate();
      }
    });

    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);

    tr.appendChild(DomHelpers.createCell(null, nameInput));
    tr.appendChild(DomHelpers.createCell(null, DomHelpers.createParagraph(topic.questionNotebook?.name ?? "—")));
    tr.appendChild(DomHelpers.createCell(null, solvedInput));
    tr.appendChild(DomHelpers.createCell(null, correctInput));

    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);

    return tr;
  }

  private renderDetailRow(topic: Topic, data: LeifPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-detail-row";

    const td = DomHelpers.createElement("td");
    td.colSpan = 5;

    const content = DomHelpers.createElement("div", "leif-detail-content");

    const notebookName = DomHelpers.createInput("text", "Caderno", topic.questionNotebook?.name ?? "");
    const notebookUrl = DomHelpers.createInput("url", "URL", topic.questionNotebook?.url ?? "");
    const notebookSolved = DomHelpers.createInput(
      "number",
      "Resolv.",
      String(topic.questionNotebook?.solvedQuestions ?? 0)
    );
    const notebookCorrect = DomHelpers.createInput(
      "number",
      "Acert.",
      String(topic.questionNotebook?.correctAnswers ?? 0)
    );

    const notebookForm = DomHelpers.createForm(async () => {
      try {
        await this.linkQuestionNotebookUseCase.execute({
          topicId: topic.id,
          questionNotebook: {
            id: topic.questionNotebook?.id ?? `${topic.id}-notebook`,
            name: notebookName.value,
            url: notebookUrl.value,
            solvedQuestions: Number(notebookSolved.value),
            correctAnswers: Number(notebookCorrect.value)
          }
        });
        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "Não foi possível vincular caderno.");
      }
    });

    notebookForm.className = "leif-detail-form";
    notebookForm.dataset.topicNotebookForm = topic.id;
    notebookForm.append(
      DomHelpers.createLabel("Caderno", notebookName),
      DomHelpers.createLabel("URL", notebookUrl),
      DomHelpers.createLabel("Resolv.", notebookSolved),
      DomHelpers.createLabel("Acert.", notebookCorrect),
      DomHelpers.createIconButton("save", "Salvar", { onClick: () => notebookForm.requestSubmit() })
    );

    content.appendChild(notebookForm);

    td.appendChild(content);
    tr.appendChild(td);

    return tr;
  }

  private openCreateTopicModal(subjectId: string): void {
    const nameInput = DomHelpers.createInput("text", "Nome do assunto");

    const form = DomHelpers.createForm(async () => {
      try {
        await this.createTopicUseCase.execute({
          id: `${subjectId}-topic-${Date.now()}`,
          subjectId,
          name: nameInput.value
        });
        modal.close();
        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "Não foi possível criar o assunto.");
      }
    });

    form.append(DomHelpers.createLabel("Nome", nameInput));

    const modal = DomHelpers.createModal({
      title: "Novo assunto",
      content: form,
      onSubmit: () => form.requestSubmit()
    });

    modal.open();
  }

  private renderSubjectPicker(data: LeifPluginData): HTMLElement {
    const subjects = data.subjects
      .filter((subject) => subject.contestId === data.activeContestId)
      .sort((left, right) => left.order - right.order);

    const select = DomHelpers.createSelect(
      subjects.map((subject) => [subject.id, subject.name]),
      this.selectedSubjectId ?? undefined
    );
    select.addEventListener("change", async () => {
      this.selectedSubjectId = select.value;
      await this.onUpdate();
    });

    const wrapper = DomHelpers.createElement("div", "leif-toolbar");
    wrapper.appendChild(DomHelpers.createLabel("Matéria", select));
    return wrapper;
  }

  private getSelectedSubject(data: LeifPluginData): { id: string; name: string } | null {
    const subjects = data.subjects
      .filter((subject) => subject.contestId === data.activeContestId)
      .sort((left, right) => left.order - right.order);

    if (subjects.length === 0) return null;
    return subjects.find((subject) => subject.id === this.selectedSubjectId) ?? subjects[0];
  }

  private notifyError(error: unknown, fallbackMessage: string): void {
    new Notice(error instanceof Error ? error.message : fallbackMessage);
  }
}
