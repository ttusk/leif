import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateResourceUseCase } from "@/application/use-cases/CreateResourceUseCase";
import { DeleteResourceUseCase } from "@/application/use-cases/DeleteResourceUseCase";
import { UpdateResourceUseCase } from "@/application/use-cases/UpdateResourceUseCase";
import { createLeifId } from "@/application/Id";
import type { Resource } from "@/domain/entities/Resource";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { GoalUnit, isGoalUnit } from "@/domain/types/GoalUnit";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { SubjectPicker } from "@/ui/view/shared/SubjectPicker";

/**
 * Recursos view — readable table per selected Matéria. Display rows show the
 * recurso title, formato, and meta; row actions open a native Obsidian menu.
 * Editing swaps in an inline editing row using the same sticky Actions column.
 */
export class ItemsTab {
  private readonly createResource: CreateResourceUseCase;
  private readonly updateResource: UpdateResourceUseCase;
  private readonly deleteResource: DeleteResourceUseCase;
  private selectedSubjectId: string | null = null;
  private editingResourceId: string | null = null;

  constructor(
    dataStore: PluginDataStore,
    private readonly onUpdate: () => Promise<void>
  ) {
    const factory = new EntityRepositoryFactory(dataStore);
    this.createResource = new CreateResourceUseCase(dataStore, factory);
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
      "Ações"
    ]);
    resources.forEach((resource) => {
      tbody.appendChild(
        this.editingResourceId === resource.id
          ? this.renderEditableRow(resource)
          : this.renderDisplayRow(resource)
      );
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
        resource.goal ? `${resource.goal.amount} ${resource.goal.unit}` : "Sem meta"
      ),
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
      Object.values(GoalUnit).map((value) => [value, value]),
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
      DomHelpers.createActionsCell(controls)
    );
    return tr;
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
    const unit = DomHelpers.createSelect(
      Object.values(GoalUnit).map((value) => [value, value]),
      GoalUnit.PAGINAS
    );
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
