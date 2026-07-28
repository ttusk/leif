import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateTopicUseCase } from "@/application/use-cases/CreateTopicUseCase";
import { DeleteTopicUseCase } from "@/application/use-cases/DeleteTopicUseCase";
import { UpdateTopicUseCase } from "@/application/use-cases/UpdateTopicUseCase";
import { createLeifId } from "@/application/Id";
import type { Topic } from "@/domain/entities/Topic";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { SubjectPicker } from "@/ui/view/shared/SubjectPicker";

/**
 * Assuntos view — readable table per selected Matéria. Display rows show the
 * assunto name; row actions open a native Obsidian menu. Editing swaps in an
 * inline editing row using the same sticky Actions column.
 */
export class TopicsTab {
  private readonly createTopic: CreateTopicUseCase;
  private readonly updateTopic: UpdateTopicUseCase;
  private readonly deleteTopic: DeleteTopicUseCase;
  private selectedSubjectId: string | null = null;
  private editingTopicId: string | null = null;

  constructor(
    dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const factory = new EntityRepositoryFactory(dataStore);
    this.createTopic = new CreateTopicUseCase(dataStore, factory);
    this.updateTopic = new UpdateTopicUseCase(dataStore, factory);
    this.deleteTopic = new DeleteTopicUseCase(dataStore, factory);
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Assuntos"));
    const selected = SubjectPicker.getSelectedSubject(data, this.selectedSubjectId);
    if (!selected) {
      container.appendChild(
        DomHelpers.createEmptyState("Sem matéria", "Crie uma matéria primeiro.")
      );
      return;
    }
    this.selectedSubjectId = selected.id;
    container.appendChild(
      SubjectPicker.create(data, selected.id, async (subjectId) => {
        this.selectedSubjectId = subjectId;
        this.editingTopicId = null;
        await this.onUpdate();
      })
    );
    container.appendChild(this.renderCreateForm(selected.id));

    const card = DomHelpers.createCard("Assuntos da matéria");
    const topics = data.topics
      .filter((topic) => topic.subjectId === selected.id)
      .sort((left, right) => left.name.localeCompare(right.name));
    if (topics.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Ainda não há assuntos nessa matéria."));
      container.appendChild(card);
      return;
    }

    const { container: tableContainer, tbody } = DomHelpers.createCrudTable(["Assunto", "Ações"]);
    topics.forEach((topic) => {
      tbody.appendChild(
        this.editingTopicId === topic.id
          ? this.renderEditableRow(topic)
          : this.renderDisplayRow(topic)
      );
    });
    card.appendChild(tableContainer);
    container.appendChild(card);
  }

  private renderDisplayRow(topic: Topic): HTMLTableRowElement {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.topicId = topic.id;
    const title = DomHelpers.createElement("strong", "leif-topic-table-title");
    title.textContent = topic.name;
    const actions = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    actions.appendChild(
      DomHelpers.createMenuButton(
        [
          {
            label: "Editar",
            icon: "edit",
            onClick: async () => {
              this.editingTopicId = topic.id;
              await this.onUpdate();
            }
          },
          {
            label: "Excluir",
            icon: "trash-2",
            onClick: async () => {
              const confirmed = window.confirm(`Excluir o assunto "${topic.name}"?`);
              if (!confirmed) return;
              await this.deleteTopic.execute({ topicId: topic.id });
              await this.onUpdate();
            }
          }
        ],
        `Ações de ${topic.name}`
      )
    );
    tr.append(DomHelpers.createNameCell(null, title), DomHelpers.createActionsCell(actions));
    return tr;
  }

  private renderEditableRow(topic: Topic): HTMLTableRowElement {
    const tr = DomHelpers.createElement("tr", "leif-editing-row");
    tr.dataset.topicId = topic.id;
    const name = DomHelpers.createInput("text", "Nome", topic.name);
    name.dataset.topicEditorName = "true";

    const controls = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    controls.appendChild(
      DomHelpers.createIconButton("save", "Salvar", {
        dataset: { topicEditorSave: "true" },
        onClick: async () => {
          try {
            await this.updateTopic.execute({ topicId: topic.id, name: name.value });
            this.editingTopicId = null;
            await this.onUpdate();
          } catch (error) {
            DomHelpers.notifyError(error, "Não consegui salvar esse assunto.");
          }
        }
      })
    );
    controls.appendChild(
      DomHelpers.createIconButton("cancel", "Cancelar", {
        dataset: { topicEditorCancel: "true" },
        onClick: async () => {
          this.editingTopicId = null;
          await this.onUpdate();
        }
      })
    );

    tr.append(DomHelpers.createNameCell(null, name), DomHelpers.createActionsCell(controls));
    return tr;
  }

  private renderCreateForm(subjectId: string): HTMLElement {
    const form = DomHelpers.createInlineForm(
      "Novo assunto",
      async () => {
        await this.createTopic.execute({
          id: createLeifId(),
          subjectId,
          name: name.value
        });
        await this.onUpdate();
      },
      async () => this.onUpdate()
    );
    const name = DomHelpers.createInput("text", "Nome do assunto");
    name.dataset.topicCreateName = "true";
    const fields = form.querySelector("form") ?? form;
    fields.append(DomHelpers.createStackedLabel("Nome", name));
    return form;
  }
}
