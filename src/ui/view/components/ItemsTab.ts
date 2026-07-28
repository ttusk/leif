import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { AddResourceAccessUseCase } from "@/application/use-cases/AddResourceAccessUseCase";
import { CreateResourceUseCase } from "@/application/use-cases/CreateResourceUseCase";
import { DeleteResourceUseCase } from "@/application/use-cases/DeleteResourceUseCase";
import { UpdateResourceUseCase } from "@/application/use-cases/UpdateResourceUseCase";
import { createLeifId } from "@/application/Id";
import type { Resource } from "@/domain/entities/Resource";
import { ResourceAccess } from "@/domain/entities/ResourceAccess";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { GoalUnit, isGoalUnit } from "@/domain/types/GoalUnit";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { ConfirmationModal } from "@/ui/confirmation/ConfirmationModal";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { formatGoalQuantity, goalUnitOptions } from "@/ui/view/shared/StudyLabels";
import { SubjectPicker } from "@/ui/view/shared/SubjectPicker";
import type { App } from "obsidian";

/**
 * Recursos view — readable table per selected Matéria. Display rows show the
 * recurso title, formato, and meta; row actions open a native Obsidian menu.
 * Editing swaps in an inline editing row using the same sticky Actions column.
 */
export class ItemsTab {
  private readonly createResource: CreateResourceUseCase;
  private readonly addResourceAccess: AddResourceAccessUseCase;
  private readonly updateResource: UpdateResourceUseCase;
  private readonly deleteResource: DeleteResourceUseCase;
  private selectedSubjectId: string | null = null;
  private editingResourceId: string | null = null;

  constructor(
    private readonly app: App,
    dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const factory = new EntityRepositoryFactory(dataStore);
    this.createResource = new CreateResourceUseCase(dataStore, factory);
    this.addResourceAccess = new AddResourceAccessUseCase(dataStore, factory);
    this.updateResource = new UpdateResourceUseCase(dataStore, factory);
    this.deleteResource = new DeleteResourceUseCase(dataStore, factory);
  }

  async render(container: HTMLElement, data: LeifPluginData): Promise<void> {
    container.appendChild(DomHelpers.createSectionTitle("Recursos"));
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
        this.editingResourceId = null;
        await this.onUpdate();
      })
    );
    container.appendChild(this.renderCreateForm(selected.id));

    const card = DomHelpers.createCard("Recursos da matéria");
    const resources = data.resources
      .filter((resource) => resource.subjectId === selected.id)
      .sort((left, right) => left.order - right.order);
    if (resources.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Ainda não há recursos nessa matéria."));
      container.appendChild(card);
      return;
    }

    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Recurso",
      "Formato",
      "Meta",
      "Materiais",
      "Ações"
    ]);
    resources.forEach((resource) => {
      if (this.editingResourceId === resource.id) {
        tbody.append(this.renderEditableRow(resource), this.renderAccessesEditorRow(resource));
      } else {
        tbody.appendChild(this.renderDisplayRow(resource));
      }
    });
    card.appendChild(tableContainer);
    container.appendChild(card);
  }

  private renderDisplayRow(resource: Resource): HTMLTableRowElement {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.resourceId = resource.id;
    const title = DomHelpers.createElement("strong", "leif-resource-table-title");
    title.textContent = resource.title;
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
              this.editingResourceId = resource.id;
              await this.onUpdate();
            }
          },
          {
            label: "Excluir",
            icon: "trash-2",
            onClick: async () => {
              const confirmed = await ConfirmationModal.ask(this.app, {
                title: "Excluir recurso?",
                message: `O recurso "${resource.title}" será excluído e suas referências serão removidas.`,
                confirmLabel: "Excluir recurso"
              });
              if (!confirmed) return;
              await this.deleteResource.execute({ resourceId: resource.id });
              await this.onUpdate();
            }
          }
        ],
        `Ações de ${resource.title}`
      )
    );
    tr.append(
      DomHelpers.createNameCell(null, title),
      DomHelpers.createNumericCell(resource.format ?? "outro"),
      DomHelpers.createNumericCell(
        resource.goal ? formatGoalQuantity(resource.goal.amount, resource.goal.unit) : "Sem meta"
      ),
      DomHelpers.createCell(null, this.renderAccesses(resource)),
      DomHelpers.createActionsCell(actions)
    );
    return tr;
  }

  private renderEditableRow(resource: Resource): HTMLTableRowElement {
    const tr = DomHelpers.createElement("tr", "leif-editing-row");
    tr.dataset.resourceId = resource.id;

    const title = DomHelpers.createInput("text", "Título", resource.title);
    title.dataset.resourceEditorTitle = "true";
    const format = DomHelpers.createInput("text", "Formato", resource.format ?? "");
    format.dataset.resourceEditorFormat = "true";
    const amount = DomHelpers.createInput(
      "number",
      "Meta",
      resource.goal ? String(resource.goal.amount) : ""
    );
    amount.dataset.resourceEditorAmount = "true";
    const unit = DomHelpers.createSelect(
      goalUnitOptions(),
      resource.goal?.unit ?? GoalUnit.PAGINAS
    );
    unit.dataset.resourceEditorUnit = "true";
    const metaGroup = DomHelpers.createElement("div", "leif-resource-material-info");
    metaGroup.append(amount, unit);

    const controls = DomHelpers.createElement(
      "div",
      "leif-inline-actions leif-inline-actions-compact"
    );
    controls.appendChild(
      DomHelpers.createIconButton("save", "Salvar", {
        dataset: { resourceEditorSave: "true" },
        onClick: async () => {
          const goalAmount = Number(amount.value);
          const goal =
            Number.isFinite(goalAmount) && goalAmount > 0 && isGoalUnit(unit.value)
              ? new ResourceGoal(goalAmount, unit.value)
              : null;
          try {
            await this.updateResource.execute({
              resourceId: resource.id,
              title: title.value,
              format: format.value || undefined,
              goal
            });
            this.editingResourceId = null;
            await this.onUpdate();
          } catch (error) {
            DomHelpers.notifyError(error, "Não consegui salvar esse recurso.");
          }
        }
      })
    );
    controls.appendChild(
      DomHelpers.createIconButton("cancel", "Cancelar", {
        dataset: { resourceEditorCancel: "true" },
        onClick: async () => {
          this.editingResourceId = null;
          await this.onUpdate();
        }
      })
    );

    tr.append(
      DomHelpers.createNameCell(null, title),
      DomHelpers.createCell(null, format),
      DomHelpers.createCell(null, metaGroup),
      DomHelpers.createCell(
        `${resource.accesses.length} ${resource.accesses.length === 1 ? "material" : "materiais"}`
      ),
      DomHelpers.createActionsCell(controls)
    );
    return tr;
  }

  private renderAccesses(resource: Resource): HTMLElement {
    const list = DomHelpers.createElement("div", "leif-resource-access-list");
    if (resource.accesses.length === 0) {
      const empty = DomHelpers.createElement("span", "leif-table-muted");
      empty.textContent = "Sem link";
      list.appendChild(empty);
      return list;
    }
    resource.accesses.forEach((access) => {
      const link = DomHelpers.createElement("a", "leif-resource-access-link");
      link.href = access.url;
      link.textContent = access.title;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      list.appendChild(link);
    });
    return list;
  }

  private renderAccessesEditorRow(resource: Resource): HTMLTableRowElement {
    const row = DomHelpers.createElement("tr", "leif-detail-row");
    row.dataset.resourceAccessesFor = resource.id;
    const cell = DomHelpers.createElement("td");
    cell.colSpan = 5;
    const content = DomHelpers.createElement("div", "leif-resource-material-section");
    content.appendChild(DomHelpers.createSectionSubtitle("Materiais e links"));
    if (resource.accesses.length === 0) {
      content.appendChild(DomHelpers.createParagraph("Nenhum material vinculado ainda."));
    } else {
      const editors = DomHelpers.createElement("div", "leif-resource-material-editor-list");
      resource.accesses.forEach((access, index) => {
        editors.appendChild(this.renderAccessEditor(resource, access, index));
      });
      content.appendChild(editors);
    }
    content.appendChild(this.renderAddAccessForm(resource));
    cell.appendChild(content);
    row.appendChild(cell);
    return row;
  }

  private renderAccessEditor(
    resource: Resource,
    access: ResourceAccess,
    index: number
  ): HTMLElement {
    const title = DomHelpers.createInput("text", "Título", access.title);
    const url = DomHelpers.createInput("url", "https://…", access.url);
    const notes = DomHelpers.createInput("text", "Observação", access.notes ?? "");
    const editor = DomHelpers.createElement("div", "leif-resource-material-editor");
    editor.dataset.resourceAccessEditorIndex = String(index);
    const actions = DomHelpers.createElement("div", "leif-resource-material-editor-actions");
    actions.append(
      DomHelpers.createIconButton("save", "Salvar material", {
        onClick: async () => {
          try {
            const accesses = resource.accesses.map((entry, entryIndex) =>
              entryIndex === index
                ? new ResourceAccess(title.value, url.value, notes.value || undefined)
                : entry
            );
            await this.updateResource.execute({ resourceId: resource.id, accesses });
            await this.onUpdate();
          } catch (error) {
            DomHelpers.notifyError(error, "Não consegui salvar esse material.");
          }
        }
      }),
      DomHelpers.createIconButton("delete", "Excluir material", {
        onClick: async () => {
          try {
            await this.updateResource.execute({
              resourceId: resource.id,
              accesses: resource.accesses.filter((_, entryIndex) => entryIndex !== index)
            });
            await this.onUpdate();
          } catch (error) {
            DomHelpers.notifyError(error, "Não consegui excluir esse material.");
          }
        }
      })
    );
    editor.append(
      DomHelpers.createStackedLabel("Título", title),
      DomHelpers.createUrlField("URL", url),
      DomHelpers.createStackedLabel("Observação", notes),
      actions
    );
    return editor;
  }

  private renderAddAccessForm(resource: Resource): HTMLElement {
    const title = DomHelpers.createInput("text", "Título");
    title.dataset.resourceAccessCreateTitle = "true";
    const url = DomHelpers.createInput("url", "https://…");
    url.dataset.resourceAccessCreateUrl = "true";
    const notes = DomHelpers.createInput("text", "Observação");
    notes.dataset.resourceAccessCreateNotes = "true";
    const form = DomHelpers.createForm(async () => {
      try {
        await this.addResourceAccess.execute({
          resourceId: resource.id,
          title: title.value,
          url: url.value,
          notes: notes.value || undefined
        });
        this.editingResourceId = null;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "Não consegui adicionar esse material.");
      }
    });
    form.className = "leif-resource-material-form";
    form.append(
      DomHelpers.createStackedLabel("Título", title),
      DomHelpers.createUrlField("URL", url),
      DomHelpers.createStackedLabel("Observação", notes),
      DomHelpers.createButton("Adicionar", {
        icon: "add",
        onClick: () => form.requestSubmit(),
        dataset: { resourceAccessCreateSave: "true" }
      })
    );
    return form;
  }

  private renderCreateForm(subjectId: string): HTMLElement {
    const form = DomHelpers.createInlineForm(
      "Novo recurso",
      async () => {
        const goalAmount = Number(amount.value);
        const goal =
          Number.isFinite(goalAmount) && goalAmount > 0 && isGoalUnit(unit.value)
            ? new ResourceGoal(goalAmount, unit.value)
            : undefined;
        await this.createResource.execute({
          id: createLeifId(),
          subjectId,
          title: title.value,
          format: format.value || undefined,
          goal
        });
        await this.onUpdate();
      },
      async () => this.onUpdate()
    );
    const title = DomHelpers.createInput("text", "Título");
    title.dataset.resourceCreateTitle = "true";
    const format = DomHelpers.createInput("text", "Formato", "pdf");
    format.dataset.resourceCreateFormat = "true";
    const amount = DomHelpers.createInput("number", "Meta");
    amount.dataset.resourceCreateAmount = "true";
    const unit = DomHelpers.createSelect(goalUnitOptions(), GoalUnit.PAGINAS);
    unit.dataset.resourceCreateUnit = "true";
    const fields = form.querySelector("form") ?? form;
    fields.append(
      DomHelpers.createStackedLabel("Título", title),
      DomHelpers.createStackedLabel("Formato", format),
      DomHelpers.createStackedLabel("Meta", amount),
      DomHelpers.createStackedLabel("Unidade", unit)
    );
    return form;
  }
}
