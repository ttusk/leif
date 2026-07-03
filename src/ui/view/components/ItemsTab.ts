import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { AddStudyItemResourceReferenceUseCase } from "@/application/use-cases/AddStudyItemResourceReferenceUseCase";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { DeleteStudyItemUseCase } from "@/application/use-cases/DeleteStudyItemUseCase";
import { GetActiveContestProgressDashboardUseCase } from "@/application/use-cases/GetActiveContestProgressDashboardUseCase";
import { UpdateStudyItemUseCase } from "@/application/use-cases/UpdateStudyItemUseCase";
import type { PdfItemProgress } from "@/application/use-cases/GetActiveContestProgressDashboardUseCase";
import type { StudyItem } from "@/domain/entities/StudyItem";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { SubjectPicker } from "@/ui/view/shared/SubjectPicker";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";

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

  private selectedSubjectId: string | null = null;
  private editingItemId: string | null = null;
  private expandedItemId: string | null = null;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.createStudyItemUseCase = new CreateStudyItemUseCase(dataStore, repositoryFactory);
    this.addStudyItemResourceReferenceUseCase = new AddStudyItemResourceReferenceUseCase(dataStore, repositoryFactory);
    this.getActiveContestProgressDashboardUseCase = new GetActiveContestProgressDashboardUseCase(dataStore);
    this.deleteStudyItemUseCase = new DeleteStudyItemUseCase(dataStore, repositoryFactory);
    this.updateStudyItemUseCase = new UpdateStudyItemUseCase(dataStore, repositoryFactory);
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Itens e PDFs"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Novo item", {
        onClick: () =>
          this.openCreateItemModal(
            SubjectPicker.getSelectedSubject(data, this.selectedSubjectId)?.id ?? ""
          )
      })
    );
    container.appendChild(header);

    const subject = SubjectPicker.getSelectedSubject(data, this.selectedSubjectId);
    if (!subject) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Nenhuma matéria selecionada",
          "Cadastre matérias no concurso ativo."
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
      "Páginas",
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
    itemProgress: PdfItemProgress | undefined,
    data: LeifPluginData
  ): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.itemId = item.id;
    const refs = item.resourceReferences ?? [];

    tr.appendChild(DomHelpers.createCell(String(item.order)));
    tr.appendChild(DomHelpers.createCell(item.title));
    tr.appendChild(DomHelpers.createCell(String(item.weight ?? 0)));
    tr.appendChild(DomHelpers.createCell(String(item.questionCount ?? 0)));
    tr.appendChild(DomHelpers.createCell(null, this.renderPagesCell(item, itemProgress)));

    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    const hasRefs = refs.length > 0;
    actions.appendChild(
      DomHelpers.createIconButton(
        this.expandedItemId === item.id ? "collapse" : "expand",
        this.expandedItemId === item.id ? "Recolher" : "Expandir",
        {
          className: `leif-icon-button ${hasRefs ? "" : "leif-expand-button"}`,
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
          const confirmed = await DomHelpers.confirm({
            title: "Excluir item",
            message: `Excluir "${item.title}"?`,
            confirmLabel: "Excluir"
          });
          if (!confirmed) return;
          try {
            await this.deleteStudyItemUseCase.execute({ itemId: item.id });
            await this.onUpdate();
          } catch (error) {
            DomHelpers.notifyError(error, "Não foi possível excluir o item.");
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
    itemProgress: PdfItemProgress | undefined,
    data: LeifPluginData
  ): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-editing-row";
    tr.dataset.itemId = item.id;

    const titleInput = DomHelpers.createCompactInput("text", "Título", item.title);
    const weightInput = DomHelpers.createCompactInput("number", "Peso", String(item.weight ?? 0));
    const questionInput = DomHelpers.createCompactInput("number", "Qts", String(item.questionCount ?? 0));
    const totalPagesInput = DomHelpers.createCompactInput("number", "Total", String(item.totalPages ?? ""));

    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          const rawPages = totalPagesInput.value.trim();
          await this.updateStudyItemUseCase.execute({
            itemId: item.id,
            title: titleInput.value,
            weight: Number(weightInput.value),
            questionCount: Number(questionInput.value),
            totalPages: rawPages === "" ? undefined : Number(rawPages)
          });
          this.editingItemId = null;
          await this.onUpdate();
        } catch (error) {
          DomHelpers.notifyError(error, "Não foi possível salvar.");
        }
      }
    });

    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingItemId = null;
        await this.onUpdate();
      }
    });

    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);

    tr.appendChild(DomHelpers.createCell(String(item.order)));
    tr.appendChild(DomHelpers.createCell(null, titleInput));
    tr.appendChild(DomHelpers.createCell(null, weightInput));
    tr.appendChild(DomHelpers.createCell(null, questionInput));
    tr.appendChild(DomHelpers.createCell(null, totalPagesInput));

    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);

    return tr;
  }

  private renderPagesCell(item: StudyItem, progress: PdfItemProgress | undefined): HTMLElement {
    const cell = DomHelpers.createElement("div", "leif-pages-cell");
    const readed = progress?.pagesReaded ?? 0;
    const total = item.totalPages;

    const progressBar = DomHelpers.createProgressBar(readed, total);
    cell.appendChild(progressBar);

    if (progress?.completed) {
      const badge = DomHelpers.createElement("span", "leif-pages-completed");
      badge.textContent = "✓ Concluído";
      cell.appendChild(badge);
    }

    return cell;
  }

  private renderDetailRow(item: StudyItem, data: LeifPluginData): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-detail-row";

    const td = DomHelpers.createElement("td");
    td.colSpan = 6;

    const content = DomHelpers.createElement("div", "leif-detail-content");

    // Resource references list
    if (item.resourceReferences && item.resourceReferences.length > 0) {
      const list = DomHelpers.createElement("div", "leif-detail-list");
      item.resourceReferences.forEach((ref) => {
        const row = DomHelpers.createElement("div", "leif-detail-list-item");
        row.appendChild(
          DomHelpers.createParagraph(`${this.formatResourceType(ref.type)}: ${ref.title}`)
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
      ["pdf", "PDF"],
      ["video", "Vídeo"],
      ["link", "Link"]
    ]);
    const urlInput = DomHelpers.createInput("url", "URL");

    const form = DomHelpers.createForm(async () => {
      try {
        await this.addStudyItemResourceReferenceUseCase.execute({
          studyItemId: item.id,
          resourceReference: {
            id: `${item.id}-resource-${Date.now()}`,
            title: titleInput.value,
            type: typeSelect.value as "pdf" | "video" | "link",
            url: urlInput.value
          }
        });
        titleInput.value = "";
        urlInput.value = "";
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não foi possível adicionar referência.");
      }
    });

    form.className = "leif-detail-form";
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

  private openCreateItemModal(subjectId: string): void {
    const titleInput = DomHelpers.createInput("text", "Título do item");
    const weightInput = DomHelpers.createInput("number", "Peso", "1");
    const questionCountInput = DomHelpers.createInput("number", "Total de questões", "0");
    const totalPagesInput = DomHelpers.createInput("number", "Total de páginas (opcional)", "");

    const form = DomHelpers.createForm(async () => {
      try {
        const rawPages = totalPagesInput.value.trim();
        await this.createStudyItemUseCase.execute({
          id: `${subjectId}-item-${Date.now()}`,
          subjectId,
          title: titleInput.value,
          weight: Number(weightInput.value),
          questionCount: Number(questionCountInput.value),
          totalPages: rawPages === "" ? undefined : Number(rawPages)
        });
        modal.close();
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não foi possível criar o item.");
      }
    });

    form.append(
      DomHelpers.createLabel("Título", titleInput),
      DomHelpers.createLabel("Peso", weightInput),
      DomHelpers.createLabel("Questões", questionCountInput),
      DomHelpers.createLabel("Páginas", totalPagesInput)
    );

    const modal = DomHelpers.createModal({
      title: "Novo item",
      content: form,
      onSubmit: () => form.requestSubmit()
    });

    modal.open();
  }

  private formatResourceType(type: "pdf" | "video" | "link"): string {
    if (type === "pdf") return "PDF";
    if (type === "video") return "Vídeo";
    return "Link";
  }
}
