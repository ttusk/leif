import { Notice } from "obsidian";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { AddStudyItemResourceReferenceUseCase } from "@/application/use-cases/AddStudyItemResourceReferenceUseCase";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { DeleteStudyItemUseCase } from "@/application/use-cases/DeleteStudyItemUseCase";
import { ExportToCsvUseCase } from "@/application/use-cases/ExportToCsvUseCase";
import { GetActiveContestProgressDashboardUseCase } from "@/application/use-cases/GetActiveContestProgressDashboardUseCase";
import { UpdateStudyItemUseCase } from "@/application/use-cases/UpdateStudyItemUseCase";
import type { StudyItem } from "@/domain/entities/StudyItem";
import type { CorvoPluginData } from "@/domain/types/CorvoPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";

/**
 * Items tab component with unified CRUD pattern.
 * Table with inline editing + expandable detail rows for resource references.
 */
export class ItemsTab {
  private readonly createStudyItemUseCase: CreateStudyItemUseCase;
  private readonly addStudyItemResourceReferenceUseCase: AddStudyItemResourceReferenceUseCase;
  private readonly getActiveContestProgressDashboardUseCase: GetActiveContestProgressDashboardUseCase;
  private readonly deleteStudyItemUseCase: DeleteStudyItemUseCase;
  private readonly updateStudyItemUseCase: UpdateStudyItemUseCase;
  private readonly exportToCsvUseCase: ExportToCsvUseCase;

  private selectedSubjectId: string | null = null;
  private editingItemId: string | null = null;
  private expandedItemId: string | null = null;
  private isCreatingNew = false;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    this.createStudyItemUseCase = new CreateStudyItemUseCase(dataStore);
    this.addStudyItemResourceReferenceUseCase = new AddStudyItemResourceReferenceUseCase(dataStore);
    this.getActiveContestProgressDashboardUseCase = new GetActiveContestProgressDashboardUseCase(dataStore);
    this.deleteStudyItemUseCase = new DeleteStudyItemUseCase(dataStore);
    this.updateStudyItemUseCase = new UpdateStudyItemUseCase(dataStore);
    this.exportToCsvUseCase = new ExportToCsvUseCase(dataStore);
  }

  async render(container: HTMLElement, data: CorvoPluginData): Promise<void> {
    const header = DomHelpers.createElement("div", "corvo-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Itens e PDFs"));
    const actions = DomHelpers.createElement("div", "corvo-inline-actions");
    actions.appendChild(
      DomHelpers.createIconButton("add", "Novo item", {
        onClick: async () => {
          this.isCreatingNew = true;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("download", "Exportar CSV", {
        onClick: async () => {
          try {
            await this.exportToCsvUseCase.execute({ entityType: "items", subjectId: this.selectedSubjectId ?? undefined });
          } catch (error) {
            this.notifyError(error, "Não foi possível exportar.");
          }
        }
      })
    );
    header.appendChild(actions);
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
      container.appendChild(this.renderCreateItemForm(subject.id));
    }

    const progress = await this.getActiveContestProgressDashboardUseCase.execute();
    const subjectProgress = progress.pdfProgressBySubject.find(
      (entry) => entry.subjectId === subject.id
    );

    const items = data.studyItems
      .filter((item) => item.subjectId === subject.id)
      .sort((left, right) => left.order - right.order);

    const card = DomHelpers.createCard(`Itens de ${subject.name}`);

    if (items.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Nenhum item cadastrado."));
      container.appendChild(card);
      return;
    }

    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Ordem",
      "Item",
      "Peso",
      "Questões",
      "PDF",
      "Ações"
    ]);

    items.forEach((item) => {
      const itemProgress = subjectProgress?.items.find(
        (entry) => entry.studyItemId === item.id
      );
      const isEditing = this.editingItemId === item.id;
      const isExpanded = this.expandedItemId === item.id;

      if (isEditing) {
        tbody.appendChild(this.renderEditableRow(item, itemProgress, data));
      } else {
        tbody.appendChild(this.renderDisplayRow(item, itemProgress, data));
      }

      if (isExpanded && !isEditing) {
        tbody.appendChild(this.renderDetailRow(item, data));
      }
    });

    card.appendChild(tableContainer);
    container.appendChild(card);
  }

  private renderDisplayRow(
    item: StudyItem,
    itemProgress: { progressCount: number } | undefined,
    data: CorvoPluginData
  ): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    const refs = item.resourceReferences ?? [];

    tr.appendChild(DomHelpers.createCell(String(item.order)));
    tr.appendChild(DomHelpers.createCell(item.title));
    tr.appendChild(DomHelpers.createCell(String(item.weight ?? 0)));
    tr.appendChild(DomHelpers.createCell(String(item.questionCount ?? 0)));
    tr.appendChild(DomHelpers.createCell(String(itemProgress?.progressCount ?? 0)));

    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    const hasRefs = refs.length > 0;
    actions.appendChild(
      DomHelpers.createIconButton(
        this.expandedItemId === item.id ? "collapse" : "expand",
        this.expandedItemId === item.id ? "Recolher" : "Expandir",
        {
          className: `corvo-icon-button ${hasRefs ? "" : "corvo-expand-button"}`,
          onClick: async () => {
            this.expandedItemId = this.expandedItemId === item.id ? null : item.id;
            await this.onUpdate();
          }
        }
      )
    );
    actions.appendChild(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingItemId = item.id;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("delete", "Excluir", {
        onClick: async () => {
          if (confirm(`Excluir "${item.title}"?`)) {
            try {
              await this.deleteStudyItemUseCase.execute({ itemId: item.id });
              await this.onUpdate();
            } catch (error) {
              this.notifyError(error, "Não foi possível excluir o item.");
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

  private renderEditableRow(
    item: StudyItem,
    itemProgress: { progressCount: number } | undefined,
    data: CorvoPluginData
  ): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "corvo-editing-row";

    const weightInput = DomHelpers.createCompactInput("number", "Peso", String(item.weight ?? 0));
    const questionInput = DomHelpers.createCompactInput("number", "Qts", String(item.questionCount ?? 0));

    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateStudyItemUseCase.execute({
            itemId: item.id,
            weight: Number(weightInput.value),
            questionCount: Number(questionInput.value)
          });
          this.editingItemId = null;
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "Não foi possível salvar.");
        }
      }
    });

    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingItemId = null;
        await this.onUpdate();
      }
    });

    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);

    tr.appendChild(DomHelpers.createCell(String(item.order)));
    tr.appendChild(DomHelpers.createCell(item.title));
    tr.appendChild(DomHelpers.createCell(null, weightInput));
    tr.appendChild(DomHelpers.createCell(null, questionInput));
    tr.appendChild(DomHelpers.createCell(String(itemProgress?.progressCount ?? 0)));

    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);

    return tr;
  }

  private renderDetailRow(item: StudyItem, data: CorvoPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "corvo-detail-row";

    const td = DomHelpers.createElement("td");
    td.colSpan = 6;

    const content = DomHelpers.createElement("div", "corvo-detail-content");

    // Resource references list
    if (item.resourceReferences && item.resourceReferences.length > 0) {
      const list = DomHelpers.createElement("div", "corvo-detail-list");
      item.resourceReferences.forEach((ref) => {
        const row = DomHelpers.createElement("div", "corvo-detail-list-item");
        row.appendChild(
          DomHelpers.createParagraph(`${ref.type}: ${ref.title}`)
        );
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

    const form = DomHelpers.createForm(async () => {
      try {
        await this.addStudyItemResourceReferenceUseCase.execute({
          studyItemId: item.id,
          resourceReference: {
            id: `${item.id}-resource-${Date.now()}`,
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

    form.className = "corvo-detail-form";
    form.append(
      DomHelpers.createLabel("Título", titleInput),
      DomHelpers.createLabel("Tipo", typeSelect),
      DomHelpers.createLabel("URL", urlInput),
      DomHelpers.createIconButton("add", "Adicionar", { onClick: () => form.requestSubmit() })
    );

    content.appendChild(form);
    td.appendChild(content);
    tr.appendChild(td);

    return tr;
  }

  private renderCreateItemForm(subjectId: string): HTMLElement {
    const titleInput = DomHelpers.createInput("text", "Título do item");
    const weightInput = DomHelpers.createInput("number", "Peso", "1");
    const questionCountInput = DomHelpers.createInput("number", "Total de questões", "0");

    const form = DomHelpers.createInlineForm(
      "Novo item",
      async () => {
        try {
          await this.createStudyItemUseCase.execute({
            id: `${subjectId}-item-${Date.now()}`,
            subjectId,
            title: titleInput.value,
            weight: Number(weightInput.value),
            questionCount: Number(questionCountInput.value)
          });
          titleInput.value = "";
          weightInput.value = "1";
          questionCountInput.value = "0";
          this.isCreatingNew = false;
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "Não foi possível criar o item.");
        }
      },
      () => {
        this.isCreatingNew = false;
        this.onUpdate();
      }
    );

    const innerForm = form.querySelector("form")!;
    innerForm.append(
      DomHelpers.createLabel("Título", titleInput),
      DomHelpers.createLabel("Peso", weightInput),
      DomHelpers.createLabel("Questões", questionCountInput)
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
