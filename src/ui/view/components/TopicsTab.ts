import { Notice } from "obsidian";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { AddTopicResourceReferenceUseCase } from "@/application/use-cases/AddTopicResourceReferenceUseCase";
import { CreateTopicUseCase } from "@/application/use-cases/CreateTopicUseCase";
import { DeleteTopicUseCase } from "@/application/use-cases/DeleteTopicUseCase";
import { LinkQuestionNotebookUseCase } from "@/application/use-cases/LinkQuestionNotebookUseCase";
import { UpdateTopicUseCase } from "@/application/use-cases/UpdateTopicUseCase";
import type { Topic } from "@/domain/entities/Topic";
import type { CorvoPluginData } from "@/domain/types/CorvoPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";

/**
 * Topics tab component with unified CRUD pattern.
 * Table with inline editing + expandable detail rows for resource references and notebook.
 */
export class TopicsTab {
  private readonly createTopicUseCase: CreateTopicUseCase;
  private readonly addTopicResourceReferenceUseCase: AddTopicResourceReferenceUseCase;
  private readonly linkQuestionNotebookUseCase: LinkQuestionNotebookUseCase;
  private readonly deleteTopicUseCase: DeleteTopicUseCase;
  private readonly updateTopicUseCase: UpdateTopicUseCase;

  private selectedSubjectId: string | null = null;
  private editingTopicId: string | null = null;
  private expandedTopicId: string | null = null;
  private isCreatingNew = false;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    this.createTopicUseCase = new CreateTopicUseCase(dataStore);
    this.addTopicResourceReferenceUseCase = new AddTopicResourceReferenceUseCase(dataStore);
    this.linkQuestionNotebookUseCase = new LinkQuestionNotebookUseCase(dataStore);
    this.deleteTopicUseCase = new DeleteTopicUseCase(dataStore);
    this.updateTopicUseCase = new UpdateTopicUseCase(dataStore);
  }

  async render(container: HTMLElement, data: CorvoPluginData): Promise<void> {
    const header = DomHelpers.createElement("div", "corvo-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Assuntos e Questões"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Novo assunto", {
        onClick: async () => {
          this.isCreatingNew = true;
          await this.onUpdate();
        }
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

    if (this.isCreatingNew) {
      container.appendChild(this.renderCreateTopicForm(subject.id));
    }

    const topics = data.topics
      .filter((topic) => topic.subjectId === subject.id)
      .sort((left, right) => left.order - right.order);

    const card = DomHelpers.createCard(`Assuntos de ${subject.name}`);

    if (topics.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Nenhum assunto cadastrado."));
      container.appendChild(card);
      return;
    }

    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Ordem",
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

  private renderDisplayRow(topic: Topic, data: CorvoPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    const hasDetails = topic.resourceReferences.length > 0 || topic.questionNotebook;

    tr.appendChild(DomHelpers.createCell(String(topic.order)));
    tr.appendChild(DomHelpers.createCell(topic.name));
    tr.appendChild(DomHelpers.createCell(topic.questionNotebook?.name ?? "—"));
    tr.appendChild(DomHelpers.createCell(String(topic.questionNotebook?.solvedQuestions ?? 0)));
    tr.appendChild(DomHelpers.createCell(String(topic.questionNotebook?.correctAnswers ?? 0)));

    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    actions.appendChild(
      DomHelpers.createIconButton(
        this.expandedTopicId === topic.id ? "collapse" : "expand",
        this.expandedTopicId === topic.id ? "Recolher" : "Expandir",
        {
          className: `corvo-icon-button ${hasDetails ? "" : "corvo-expand-button"}`,
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
          if (confirm(`Excluir "${topic.name}"?`)) {
            try {
              await this.deleteTopicUseCase.execute({ topicId: topic.id });
              await this.onUpdate();
            } catch (error) {
              this.notifyError(error, "Não foi possível excluir o assunto.");
            }
          }
        }
      })
    );

    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);

    return tr;
  }

  private renderEditableRow(topic: Topic, data: CorvoPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "corvo-editing-row";

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

    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);

    tr.appendChild(DomHelpers.createCell(String(topic.order)));
    tr.appendChild(DomHelpers.createCell(null, nameInput));
    tr.appendChild(DomHelpers.createCell(null, DomHelpers.createParagraph(topic.questionNotebook?.name ?? "—")));
    tr.appendChild(DomHelpers.createCell(null, solvedInput));
    tr.appendChild(DomHelpers.createCell(null, correctInput));

    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);

    return tr;
  }

  private renderDetailRow(topic: Topic, data: CorvoPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "corvo-detail-row";

    const td = DomHelpers.createElement("td");
    td.colSpan = 6;

    const content = DomHelpers.createElement("div", "corvo-detail-content");

    // Resource references list
    if (topic.resourceReferences.length > 0) {
      const list = DomHelpers.createElement("div", "corvo-detail-list");
      topic.resourceReferences.forEach((ref) => {
        const row = DomHelpers.createElement("div", "corvo-detail-list-item");
        row.appendChild(DomHelpers.createParagraph(`${ref.type}: ${ref.title}`));
        if (ref.url) {
          const link = DomHelpers.createElement("a");
          link.href = ref.url;
          link.textContent = "🔗";
          link.target = "_blank";
          row.appendChild(link);
        }
        list.appendChild(row);
      });
      content.appendChild(list);
    }

    // Add resource reference form
    const titleInput = DomHelpers.createInput("text", "Título");
    const typeSelect = DomHelpers.createSelect([
      ["pdf", "pdf"],
      ["video", "video"],
      ["link", "link"],
      ["question-notebook", "question-notebook"]
    ]);
    const urlInput = DomHelpers.createInput("url", "URL");

    const resourceForm = DomHelpers.createForm(async () => {
      try {
        await this.addTopicResourceReferenceUseCase.execute({
          topicId: topic.id,
          resourceReference: {
            id: `${topic.id}-resource-${Date.now()}`,
            title: titleInput.value,
            type: typeSelect.value as "pdf" | "video" | "link" | "question-notebook",
            url: urlInput.value
          }
        });
        titleInput.value = "";
        urlInput.value = "";
        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "Não foi possível adicionar referência.");
      }
    });

    resourceForm.className = "corvo-detail-form";
    resourceForm.append(
      DomHelpers.createLabel("Título", titleInput),
      DomHelpers.createLabel("Tipo", typeSelect),
      DomHelpers.createLabel("URL", urlInput),
      DomHelpers.createIconButton("add", "Adicionar", { onClick: () => resourceForm.requestSubmit() })
    );

    content.appendChild(resourceForm);

    // Notebook form
    if (topic.questionNotebook) {
      const notebookName = DomHelpers.createInput("text", "Nome", topic.questionNotebook.name);
      const notebookSolved = DomHelpers.createInput("number", "Resolv.", String(topic.questionNotebook.solvedQuestions));
      const notebookCorrect = DomHelpers.createInput("number", "Acert.", String(topic.questionNotebook.correctAnswers));

      const notebookForm = DomHelpers.createForm(async () => {
        try {
          await this.linkQuestionNotebookUseCase.execute({
            topicId: topic.id,
            questionNotebook: {
              id: topic.questionNotebook?.id ?? `${topic.id}-notebook`,
              name: notebookName.value,
              url: topic.questionNotebook?.url ?? "",
              solvedQuestions: Number(notebookSolved.value),
              correctAnswers: Number(notebookCorrect.value)
            }
          });
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "Não foi possível vincular caderno.");
        }
      });

      notebookForm.className = "corvo-detail-form";
      notebookForm.append(
        DomHelpers.createLabel("Caderno", notebookName),
        DomHelpers.createLabel("Resolv.", notebookSolved),
        DomHelpers.createLabel("Acert.", notebookCorrect),
        DomHelpers.createIconButton("save", "Salvar", { onClick: () => notebookForm.requestSubmit() })
      );

      content.appendChild(notebookForm);
    }

    td.appendChild(content);
    tr.appendChild(td);

    return tr;
  }

  private renderCreateTopicForm(subjectId: string): HTMLElement {
    const nameInput = DomHelpers.createInput("text", "Nome do assunto");
    const orderInput = DomHelpers.createInput("number", "Ordem", "1");

    const form = DomHelpers.createInlineForm(
      "Novo assunto",
      async () => {
        try {
          await this.createTopicUseCase.execute({
            id: `${subjectId}-topic-${Date.now()}`,
            subjectId,
            name: nameInput.value,
            order: Number(orderInput.value)
          });
          nameInput.value = "";
          orderInput.value = "1";
          this.isCreatingNew = false;
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "Não foi possível criar o assunto.");
        }
      },
      () => {
        this.isCreatingNew = false;
        this.onUpdate();
      }
    );

    const innerForm = form.querySelector("form")!;
    innerForm.append(
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createLabel("Ordem", orderInput)
    );

    return form;
  }

  private renderSubjectPicker(data: CorvoPluginData): HTMLElement {
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

    const wrapper = DomHelpers.createElement("div", "corvo-toolbar");
    wrapper.appendChild(DomHelpers.createLabel("Matéria", select));
    return wrapper;
  }

  private getSelectedSubject(data: CorvoPluginData): { id: string; name: string } | null {
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
