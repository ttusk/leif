import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { AddStudyItemResourceReferenceUseCase } from "@/application/use-cases/AddStudyItemResourceReferenceUseCase";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { DeleteStudyItemUseCase } from "@/application/use-cases/DeleteStudyItemUseCase";
import { GetActiveContestProgressDashboardUseCase } from "@/application/use-cases/GetActiveContestProgressDashboardUseCase";
import { UpdateStudyItemUseCase } from "@/application/use-cases/UpdateStudyItemUseCase";
import type { PdfItemProgress } from "@/application/use-cases/GetActiveContestProgressDashboardUseCase";
import type { ResourceReference } from "@/domain/entities/ResourceReference";
import type { StudyItem } from "@/domain/entities/StudyItem";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { SubjectPicker } from "@/ui/view/shared/SubjectPicker";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { createId } from "@/application/Id";

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
  private isCreatingItem = false;
  private pendingDeleteItemId: string | null = null;

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.createStudyItemUseCase = new CreateStudyItemUseCase(dataStore, repositoryFactory);
    this.addStudyItemResourceReferenceUseCase = new AddStudyItemResourceReferenceUseCase(
      dataStore,
      repositoryFactory
    );
    this.getActiveContestProgressDashboardUseCase = new GetActiveContestProgressDashboardUseCase(
      dataStore
    );
    this.deleteStudyItemUseCase = new DeleteStudyItemUseCase(dataStore, repositoryFactory);
    this.updateStudyItemUseCase = new UpdateStudyItemUseCase(dataStore, repositoryFactory);
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Recursos"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Novo item", {
        onClick: async () => {
          this.isCreatingItem = true;
          await this.onUpdate();
        }
      })
    );
    container.appendChild(header);

    const subject = SubjectPicker.getSelectedSubject(data, this.selectedSubjectId);
    if (!subject) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Sem matéria escolhida",
          "Crie uma matéria em Matérias para adicionar recursos."
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

    if (this.isCreatingItem) {
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
      card.appendChild(DomHelpers.createParagraph("Nenhum recurso cadastrado nessa matéria."));
      container.appendChild(card);
      return;
    }

    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Ordem",
      "Recurso",
      "Peso",
      "Questões",
      "Páginas",
      "Ações"
    ]);

    items.forEach((item) => {
      const itemProgress = subjectProgress?.items.find((entry) => entry.studyItemId === item.id);
      const isEditing = this.editingItemId === item.id;
      const isExpanded = this.expandedItemId === item.id;

      if (isEditing) {
        tbody.appendChild(this.renderEditableRow(item));
        tbody.appendChild(this.renderEditMaterialsRow(item));
      } else {
        tbody.appendChild(this.renderDisplayRow(item, itemProgress));
      }

      if (isExpanded && !isEditing) {
        tbody.appendChild(this.renderDetailRow(item));
      }
    });

    card.appendChild(tableContainer);
    container.appendChild(card);
  }

  private renderDisplayRow(
    item: StudyItem,
    itemProgress: PdfItemProgress | undefined
  ): HTMLElement {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.itemId = item.id;
    const refs = item.resourceReferences ?? [];

    const actions = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    const hasRefs = refs.length > 0;
    actions.appendChild(
      DomHelpers.createIconButton(
        this.expandedItemId === item.id ? "collapse" : "expand",
        this.expandedItemId === item.id ? "Recolher" : "Expandir",
        {
          className: `clickable-icon ${hasRefs ? "" : "leif-expand-button"}`,
          onClick: async () => {
            this.expandedItemId = this.expandedItemId === item.id ? null : item.id;
            await this.onUpdate();
          }
        }
      )
    );
    const secondaryActions: HTMLElement[] = [];
    secondaryActions.push(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingItemId = item.id;
          await this.onUpdate();
        }
      })
    );
    secondaryActions.push(
      DomHelpers.createIconButton("delete", "Excluir", {
        onClick: async () => {
          this.pendingDeleteItemId = item.id;
          await this.onUpdate();
        }
      })
    );

    if (this.pendingDeleteItemId === item.id) {
      secondaryActions.push(
        DomHelpers.createButton("Excluir?", {
          onClick: async () => {
            try {
              await this.deleteStudyItemUseCase.execute({ itemId: item.id });
              this.pendingDeleteItemId = null;
              await this.onUpdate();
            } catch (error) {
              DomHelpers.notifyError(error, "Não consegui excluir esse recurso.");
            }
          }
        }),
        DomHelpers.createButton("Cancelar", {
          onClick: async () => {
            this.pendingDeleteItemId = null;
            await this.onUpdate();
          }
        })
      );
    }
    actions.appendChild(DomHelpers.createOverflowMenu(secondaryActions));

    const title = DomHelpers.createElement("strong", "leif-resource-table-title");
    title.textContent = item.title;
    const titleCell = DomHelpers.createCell(null, title);
    titleCell.classList.add("leif-resource-title-cell");

    tr.append(
      DomHelpers.createCell(String(item.order)),
      titleCell,
      DomHelpers.createCell(String(item.weight ?? 0)),
      DomHelpers.createCell(String(item.questionCount ?? 0)),
      DomHelpers.createCell(null, this.renderPagesCell(item, itemProgress)),
      DomHelpers.createCell(null, actions)
    );

    return tr;
  }

  private renderEditableRow(item: StudyItem): HTMLElement {
    const tr = DomHelpers.createElement("tr", "leif-editing-row");
    tr.dataset.itemId = item.id;

    const titleInput = DomHelpers.createCompactInput("text", "Título", item.title);
    const weightInput = DomHelpers.createCompactInput("number", "Peso", String(item.weight ?? 0));
    const questionInput = DomHelpers.createCompactInput(
      "number",
      "Qts",
      String(item.questionCount ?? 0)
    );
    const totalPagesInput = DomHelpers.createCompactInput(
      "number",
      "Total",
      String(item.totalPages ?? "")
    );
    titleInput.classList.add("leif-resource-edit-input");
    weightInput.classList.add("leif-resource-edit-input");
    questionInput.classList.add("leif-resource-edit-input");
    totalPagesInput.classList.add("leif-resource-edit-input");

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
          DomHelpers.notifyError(error, "Não consegui salvar.");
        }
      }
    });

    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingItemId = null;
        await this.onUpdate();
      }
    });

    const actions = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);

    tr.append(
      DomHelpers.createCell(String(item.order)),
      DomHelpers.createCell(null, titleInput),
      DomHelpers.createCell(null, weightInput),
      DomHelpers.createCell(null, questionInput),
      DomHelpers.createCell(null, totalPagesInput),
      DomHelpers.createCell(null, actions)
    );

    return tr;
  }

  private renderDetailRow(item: StudyItem): HTMLElement {
    const tr = DomHelpers.createElement("tr", "leif-detail-row");
    const td = DomHelpers.createElement("td");
    td.colSpan = 6;
    td.appendChild(this.renderDetailContent(item));
    tr.appendChild(td);
    return tr;
  }

  private renderEditMaterialsRow(item: StudyItem): HTMLElement {
    const tr = DomHelpers.createElement("tr", "leif-detail-row leif-resource-edit-materials");
    const td = DomHelpers.createElement("td");
    td.colSpan = 6;

    const content = DomHelpers.createElement("div", "leif-detail-content");
    const references = item.resourceReferences ?? [];

    const materialSection = DomHelpers.createElement("section", "leif-resource-material-section");
    materialSection.append(
      DomHelpers.createSectionSubtitle("Materiais do recurso"),
      DomHelpers.createParagraph("Edite ou remova os materiais já ligados a este recurso.")
    );

    if (references.length > 0) {
      const list = DomHelpers.createElement("div", "leif-resource-material-editor-list");
      references.forEach((reference) => {
        list.appendChild(this.renderMaterialEditor(item, reference));
      });
      materialSection.appendChild(list);
    } else {
      materialSection.appendChild(DomHelpers.createParagraph("Nenhum material vinculado ainda."));
    }

    const addSection = DomHelpers.createElement("section", "leif-resource-material-section");
    addSection.append(
      DomHelpers.createSectionSubtitle("Adicionar novo material"),
      DomHelpers.createParagraph(
        "Use esta área para anexar PDF, vídeo ou link ao recurso em edição."
      ),
      this.renderAddMaterialForm(item)
    );

    content.append(materialSection, addSection);

    td.appendChild(content);
    tr.appendChild(td);
    return tr;
  }

  private renderPagesCell(item: StudyItem, progress: PdfItemProgress | undefined): HTMLElement {
    const cell = DomHelpers.createElement("div", "leif-pages-cell");
    const readed = progress?.pagesReaded ?? 0;
    const total = item.totalPages;

    const progressBar = DomHelpers.createProgressBar(readed, total);
    cell.appendChild(progressBar);

    return cell;
  }

  private renderDetailContent(item: StudyItem): HTMLElement {
    const content = DomHelpers.createElement("div", "leif-detail-content");
    content.classList.add("leif-resource-detail");

    const header = DomHelpers.createElement("div", "leif-resource-detail-header");
    const titleGroup = DomHelpers.createElement("div", "leif-resource-detail-title-group");
    titleGroup.append(
      DomHelpers.createSectionSubtitle("Materiais deste recurso"),
      DomHelpers.createParagraph("Arquivos, aulas e links já conectados a este recurso.")
    );
    header.appendChild(titleGroup);
    content.appendChild(header);

    // Resource references list
    if (item.resourceReferences && item.resourceReferences.length > 0) {
      const list = DomHelpers.createElement("div", "leif-detail-list");
      item.resourceReferences.forEach((ref) => {
        const row = DomHelpers.createElement("div", "leif-detail-list-item leif-material-row");
        const materialInfo = DomHelpers.createElement("div", "leif-material-info");
        const type = DomHelpers.createElement("span", "leif-material-type");
        type.textContent = this.formatResourceType(ref.type);
        if (ref.url) {
          const title = DomHelpers.createElement("a", "leif-material-title");
          title.href = ref.url;
          title.textContent = ref.title;
          title.target = "_blank";
          title.rel = "noopener noreferrer";
          materialInfo.append(type, title);
        } else {
          const title = DomHelpers.createElement("span", "leif-material-title");
          title.textContent = ref.title;
          materialInfo.append(type, title);
        }
        row.appendChild(materialInfo);
        list.appendChild(row);
      });
      content.appendChild(list);
    } else {
      content.appendChild(DomHelpers.createParagraph("Nenhum material vinculado ainda."));
    }

    return content;
  }

  private renderMaterialEditor(item: StudyItem, reference: ResourceReference): HTMLElement {
    const titleInput = DomHelpers.createInput("text", "Título", reference.title);
    const typeSelect = DomHelpers.createSelect(
      [
        ["pdf", "PDF"],
        ["video", "Vídeo"],
        ["link", "Link"]
      ],
      reference.type
    );
    const urlInput = DomHelpers.createInput("url", "URL", reference.url ?? "");

    const row = DomHelpers.createElement("div", "leif-resource-material-editor");
    row.dataset.resourceMaterialEditorId = reference.id;

    row.append(
      this.renderMaterialField("Título", titleInput),
      this.renderMaterialField("Tipo", typeSelect),
      DomHelpers.createUrlField("URL", urlInput)
    );

    const actions = DomHelpers.createElement("div", "leif-resource-material-editor-actions");
    actions.append(
      DomHelpers.createIconButton("save", "Salvar material", {
        dataset: { resourceSaveMaterialId: reference.id },
        onClick: async () => {
          await this.updateMaterialReference(item, reference.id, {
            id: reference.id,
            title: titleInput.value.trim(),
            type: typeSelect.value as "pdf" | "video" | "link",
            url: urlInput.value.trim()
          });
        }
      }),
      DomHelpers.createIconButton("delete", "Excluir material", {
        dataset: { resourceDeleteMaterialId: reference.id },
        onClick: async () => {
          await this.deleteMaterialReference(item, reference.id);
        }
      })
    );

    row.appendChild(actions);
    return row;
  }

  private renderAddMaterialForm(item: StudyItem): HTMLElement {
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
            id: createId(`${item.id}-resource`),
            title: titleInput.value,
            type: typeSelect.value as "pdf" | "video" | "link",
            url: urlInput.value
          }
        });
        titleInput.value = "";
        urlInput.value = "";
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não consegui adicionar esse link.");
      }
    });

    form.className = "leif-resource-material-form";
    form.append(
      this.renderMaterialField("Título", titleInput),
      this.renderMaterialField("Tipo", typeSelect),
      DomHelpers.createUrlField("URL", urlInput),
      DomHelpers.createElement("div", "leif-form-actions")
    );

    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Salvar material", {
        type: "submit",
        className: "mod-cta"
      })
    );

    return form;
  }

  private renderMaterialField(label: string, control: HTMLElement): HTMLElement {
    const field = DomHelpers.createElement("label", "leif-material-field");
    const labelEl = DomHelpers.createElement("span", "leif-material-field-label");
    labelEl.textContent = label;
    field.append(labelEl, control);
    return field;
  }

  private async updateMaterialReference(
    item: StudyItem,
    referenceId: string,
    nextReference: ResourceReference
  ): Promise<void> {
    try {
      await this.updateStudyItemUseCase.execute({
        itemId: item.id,
        resourceReferences: (item.resourceReferences ?? []).map((reference) =>
          reference.id === referenceId ? nextReference : reference
        )
      });
      await this.onUpdate();
    } catch (error) {
      DomHelpers.notifyError(error, "Não consegui salvar esse material.");
    }
  }

  private async deleteMaterialReference(item: StudyItem, referenceId: string): Promise<void> {
    try {
      await this.updateStudyItemUseCase.execute({
        itemId: item.id,
        resourceReferences: (item.resourceReferences ?? []).filter(
          (reference) => reference.id !== referenceId
        )
      });
      await this.onUpdate();
    } catch (error) {
      DomHelpers.notifyError(error, "Não consegui excluir esse material.");
    }
  }

  private renderCreateItemForm(subjectId: string): HTMLElement {
    const titleInput = DomHelpers.createInput("text", "Título do item");
    const weightInput = DomHelpers.createInput("number", "Peso", "1");
    const questionCountInput = DomHelpers.createInput("number", "Total de questões", "0");
    const totalPagesInput = DomHelpers.createInput("number", "Total de páginas (opcional)", "");

    const form = DomHelpers.createForm(async () => {
      try {
        const rawPages = totalPagesInput.value.trim();
        await this.createStudyItemUseCase.execute({
          id: createId(`${subjectId}-item`),
          subjectId,
          title: titleInput.value,
          weight: Number(weightInput.value),
          questionCount: Number(questionCountInput.value),
          totalPages: rawPages === "" ? undefined : Number(rawPages)
        });
        this.isCreatingItem = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não consegui criar esse recurso.");
      }
    });

    const fields = DomHelpers.createElement("div", "leif-grid leif-grid-2");
    fields.append(
      DomHelpers.createLabel("Título", titleInput),
      DomHelpers.createLabel("Peso", weightInput),
      DomHelpers.createLabel("Questões", questionCountInput),
      DomHelpers.createLabel("Páginas", totalPagesInput)
    );

    form.classList.add("leif-card");
    form.append(
      DomHelpers.createSectionSubtitle("Novo recurso"),
      fields,
      DomHelpers.createElement("div", "leif-form-actions")
    );

    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isCreatingItem = false;
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

  private formatResourceType(type: "pdf" | "video" | "link"): string {
    if (type === "pdf") return "PDF";
    if (type === "video") return "Vídeo";
    return "Link";
  }
}
