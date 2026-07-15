import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateTopicUseCase } from "@/application/use-cases/CreateTopicUseCase";
import { DeleteTopicUseCase } from "@/application/use-cases/DeleteTopicUseCase";
import { UpdateTopicUseCase } from "@/application/use-cases/UpdateTopicUseCase";
import type { Topic } from "@/domain/entities/Topic";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { SubjectPicker } from "@/ui/view/shared/SubjectPicker";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { createId } from "@/application/Id";

/**
 * Topics tab component with unified CRUD pattern.
 * Table with inline editing + expandable detail rows for question notebooks.
 */
export class TopicsTab {
  private readonly createTopicUseCase: CreateTopicUseCase;
  private readonly deleteTopicUseCase: DeleteTopicUseCase;
  private readonly updateTopicUseCase: UpdateTopicUseCase;

  private selectedSubjectId: string | null = null;
  private editingTopicId: string | null = null;
  private expandedTopicId: string | null = null;
  private isCreatingTopic = false;
  private pendingDeleteTopicId: string | null = null;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.createTopicUseCase = new CreateTopicUseCase(dataStore, repositoryFactory);
    this.deleteTopicUseCase = new DeleteTopicUseCase(dataStore, repositoryFactory);
    this.updateTopicUseCase = new UpdateTopicUseCase(dataStore, repositoryFactory);
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Edital"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Novo assunto", {
        onClick: async () => {
          this.isCreatingTopic = true;
          await this.onUpdate();
        }
      })
    );
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph(
        "Transforme o edital em assuntos pequenos e conecte cadernos de questões quando fizer sentido."
      )
    );

    const subject = SubjectPicker.getSelectedSubject(data, this.selectedSubjectId);
    if (!subject) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Sem matéria escolhida",
          "Crie uma matéria no Plano para organizar o edital."
        )
      );
      return;
    }

    container.appendChild(
      SubjectPicker.create(data, this.selectedSubjectId, async (subjectId) => {
        this.selectedSubjectId = subjectId;
        await this.onUpdate();
      })
    );

    if (this.isCreatingTopic) {
      container.appendChild(this.renderCreateTopicForm(subject.id));
    }

    const topics = data.topics
      .filter((topic) => topic.subjectId === subject.id);

    const card = DomHelpers.createCard(`Assuntos de ${subject.name}`);

    if (topics.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Nenhum assunto cadastrado nessa matéria."));
      container.appendChild(card);
      return;
    }

    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Assunto",
      "Questões",
      "Caderno",
      "Ações"
    ]);

    topics.forEach((topic) => {
      const isEditing = this.editingTopicId === topic.id;
      const isExpanded = this.expandedTopicId === topic.id;

      if (isEditing) {
        tbody.appendChild(this.renderEditableRow(topic));
      } else {
        tbody.appendChild(this.renderDisplayRow(topic));
      }

      if (isExpanded && !isEditing) {
        tbody.appendChild(this.renderDetailRow(topic));
      }
    });

    card.appendChild(tableContainer);
    container.appendChild(card);
  }

  private renderDisplayRow(topic: Topic): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.topicId = topic.id;
    const hasDetails = Boolean(topic.questionNotebook);

    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(
      DomHelpers.createIconButton(
        this.expandedTopicId === topic.id ? "collapse" : "expand",
        this.expandedTopicId === topic.id ? "Recolher" : "Expandir",
        {
          className: `clickable-icon ${hasDetails ? "" : "leif-expand-button"}`,
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
          this.pendingDeleteTopicId = topic.id;
          await this.onUpdate();
        }
      })
    );

    if (this.pendingDeleteTopicId === topic.id) {
      actions.append(
        DomHelpers.createButton("Excluir?", {
          onClick: async () => {
            try {
              await this.deleteTopicUseCase.execute({ topicId: topic.id });
              this.pendingDeleteTopicId = null;
              await this.onUpdate();
            } catch (error) {
              DomHelpers.notifyError(error, "Não consegui excluir esse assunto.");
            }
          }
        }),
        DomHelpers.createButton("Cancelar", {
          onClick: async () => {
            this.pendingDeleteTopicId = null;
            await this.onUpdate();
          }
        })
      );
    }

    const titleCell = DomHelpers.createElement("td", "leif-topic-title-cell");
    const title = DomHelpers.createElement("span", "leif-topic-title");
    title.textContent = topic.name;
    titleCell.appendChild(title);

    tr.appendChild(titleCell);
    tr.appendChild(DomHelpers.createCell(this.formatQuestionProgress(topic)));
    tr.appendChild(DomHelpers.createCell(null, this.renderNotebookCell(topic)));
    const actionsCell = DomHelpers.createCell(null, actions);
    actionsCell.classList.add("leif-actions-cell");
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

  private renderEditableRow(topic: Topic): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-editing-row";
    tr.dataset.topicId = topic.id;

    const nameInput = DomHelpers.createInput("text", "Nome do assunto", topic.name);
    nameInput.classList.add("leif-topic-name-input");
    const notebookNameInput = DomHelpers.createInput("text", "Nome do caderno", topic.questionNotebook?.name ?? "");
    const notebookUrlInput = DomHelpers.createInput("url", "URL do caderno", topic.questionNotebook?.url ?? "");
    const solvedInput = DomHelpers.createCompactInput(
      "number",
      "Questões resolvidas",
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
          const shouldSaveNotebook =
            Boolean(topic.questionNotebook) ||
            Boolean(notebookNameInput.value.trim()) ||
            Boolean(notebookUrlInput.value.trim());

          await this.updateTopicUseCase.execute({
            topicId: topic.id,
            name: nameInput.value,
            questionNotebook: shouldSaveNotebook
              ? {
                  id: topic.questionNotebook?.id ?? `${topic.id}-notebook`,
                  name: notebookNameInput.value,
                  url: notebookUrlInput.value,
                  solvedQuestions: Number(solvedInput.value),
                  correctAnswers: Number(correctInput.value)
                }
              : undefined
          });
          this.editingTopicId = null;
          await this.onUpdate();
        } catch (error) {
          DomHelpers.notifyError(error, "Não consegui salvar.");
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

    const titleCell = DomHelpers.createElement("td", "leif-topic-title-cell");
    titleCell.appendChild(nameInput);
    tr.appendChild(titleCell);

    const questionCell = DomHelpers.createElement("td");
    const questionFields = DomHelpers.createElement("div", "leif-topic-question-editor");
    questionFields.append(
      DomHelpers.createStackedLabel("Questões resolvidas", solvedInput),
      DomHelpers.createStackedLabel("Acertos", correctInput)
    );
    questionCell.appendChild(questionFields);
    tr.appendChild(questionCell);

    const notebookEditor = DomHelpers.createElement("div", "leif-topic-notebook-editor leif-topic-notebook-editor-stacked");
    notebookEditor.append(
      DomHelpers.createStrong("Caderno de questões"),
      DomHelpers.createStackedLabel("Nome", notebookNameInput),
      DomHelpers.createStackedLabel("URL", notebookUrlInput)
    );

    tr.appendChild(DomHelpers.createCell(null, notebookEditor));
    const actionsCell = DomHelpers.createCell(null, actions);
    actionsCell.classList.add("leif-actions-cell");
    tr.appendChild(actionsCell);

    return tr;
  }

  private renderDetailRow(topic: Topic): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-detail-row";

    const td = DomHelpers.createElement("td");
    td.colSpan = 4;

    const content = DomHelpers.createElement("div", "leif-detail-content leif-topic-detail");
    const notebook = topic.questionNotebook;
    content.appendChild(DomHelpers.createSectionSubtitle("Caderno de questões"));

    if (!notebook) {
      content.appendChild(DomHelpers.createParagraph("Nenhum caderno conectado ainda."));
    } else {
      const list = DomHelpers.createElement("div", "leif-detail-list");
      const row = DomHelpers.createElement("div", "leif-detail-list-item");
      const info = DomHelpers.createElement("div", "leif-material-info");
      const title = DomHelpers.createElement("span", "leif-material-title");
      title.textContent = notebook.name;
      const stats = DomHelpers.createElement("span", "leif-material-type");
      stats.textContent = this.formatQuestionProgress(topic);
      info.append(stats, title);
      row.appendChild(info);

      if (notebook.url) {
        const link = DomHelpers.createElement("a", "leif-material-open-link");
        link.href = notebook.url;
        link.textContent = "Abrir";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.dataset.topicNotebookUrl = topic.id;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          window.open(notebook.url, "_blank", "noopener");
        });
        row.appendChild(link);
      }

      list.appendChild(row);
      content.appendChild(list);
    }

    td.appendChild(content);
    tr.appendChild(td);

    return tr;
  }

  private renderCreateTopicForm(subjectId: string): HTMLElement {
    const nameInput = DomHelpers.createInput("text", "Nome do assunto");
    nameInput.classList.add("leif-topic-name-input");

    const form = DomHelpers.createForm(async () => {
      try {
        await this.createTopicUseCase.execute({
          id: createId(`${subjectId}-topic`),
          subjectId,
          name: nameInput.value
        });
        this.isCreatingTopic = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não consegui criar esse assunto.");
      }
    });

    form.classList.add("leif-card");
    form.append(
      DomHelpers.createSectionSubtitle("Novo assunto"),
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createElement("div", "leif-form-actions")
    );

    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isCreatingTopic = false;
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

  private formatQuestionProgress(topic: Topic): string {
    const solved = topic.questionNotebook?.solvedQuestions ?? 0;
    const correct = topic.questionNotebook?.correctAnswers ?? 0;

    if (solved === 0) {
      return "0 resolvidas";
    }

    return `${correct}/${solved} acertos`;
  }
}
