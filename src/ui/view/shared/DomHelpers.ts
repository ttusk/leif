import { Notice, setIcon, setTooltip } from "obsidian";
import { ICON_NAMES } from "@/ui/constants";
import { NoActiveContestError } from "@/domain/errors/DomainErrors";
import { t } from "@/ui/i18n";

/**
 * DOM Helper utilities for creating consistent UI elements.
 * Provides reusable methods for building common HTML structures.
 */
export class DomHelpers {
  /**
   * Creates an HTML element with optional className.
   */
  static createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    className?: string
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    return element;
  }

  /**
   * Creates an icon element using Obsidian's built-in Lucide icons.
   * @param iconKey - Key from ICON_NAMES constant
   * @param className - CSS class for the icon container
   * @returns HTMLElement containing the icon
   */
  static createIcon(iconKey: string, className = "leif-icon"): HTMLElement {
    const container = this.createElement("span", className);
    const iconName = ICON_NAMES[iconKey as keyof typeof ICON_NAMES] || iconKey;

    // Use Obsidian's setIcon if available (production)
    if (typeof setIcon === "function") {
      setIcon(container, iconName);
    } else {
      // Fallback for tests - just show the icon name
      container.textContent = iconName;
      container.setAttribute("data-icon", iconName);
    }

    return container;
  }

  /**
   * Creates text with an optional icon.
   */
  static createTextWithIcon(text: string, icon?: string): HTMLElement {
    const wrapper = this.createElement("span", "leif-text-with-icon");
    if (icon) {
      wrapper.appendChild(this.createIcon(icon));
    }
    const label = this.createElement("span", "leif-text-label");
    label.textContent = text;
    wrapper.appendChild(label);
    return wrapper;
  }

  /**
   * Creates an H1 heading with optional icon.
   */
  static createHeading(text: string, icon?: string): HTMLElement {
    const heading = this.createElement("h1", "leif-title");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }

  /**
   * Creates an H2 section title with optional icon.
   */
  static createSectionTitle(text: string, icon?: string): HTMLElement {
    const heading = this.createElement("h2", "leif-section-title");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }

  /**
   * Creates an H3 section subtitle with optional icon.
   */
  static createSectionSubtitle(text: string, icon?: string): HTMLElement {
    const heading = this.createElement("h3", "leif-section-subtitle");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }

  /**
   * Creates a paragraph element.
   */
  static createParagraph(text: string): HTMLElement {
    const paragraph = this.createElement("p", "leif-paragraph");
    paragraph.textContent = text;
    return paragraph;
  }

  /**
   * Creates a strong (bold) text element.
   */
  static createStrong(text: string): HTMLElement {
    const strong = document.createElement("strong");
    strong.textContent = text;
    return strong;
  }

  /**
   * Creates a badge with optional icon.
   */
  static createBadge(text: string, icon?: string): HTMLElement {
    const badge = this.createElement("span", "leif-badge");
    badge.appendChild(this.createTextWithIcon(text, icon));
    return badge;
  }

  /**
   * Creates a card section with title and optional icon.
   */
  static createCard(title: string, icon?: string): HTMLElement {
    const card = this.createElement("section", "leif-card");
    card.appendChild(this.createSectionSubtitle(title, icon));
    return card;
  }

  /**
   * Creates an empty state message.
   */
  static createEmptyState(title: string, description: string): HTMLElement {
    const wrapper = this.createElement("section", "leif-empty-state leif-card");
    wrapper.append(this.createStrong(title), this.createParagraph(description));
    return wrapper;
  }

  /**
   * Creates an input element.
   */
  static createInput(type: string, placeholder: string, value = ""): HTMLInputElement {
    const input = document.createElement("input");
    input.type = type;
    input.placeholder = placeholder;
    input.value = value;
    return input;
  }

  /**
   * Creates a select dropdown with options.
   * @param options - Array of [value, label] pairs
   * @param selectedValue - Optional value to pre-select
   */
  static createSelect(options: Array<[string, string]>, selectedValue?: string): HTMLSelectElement {
    const select = document.createElement("select");

    options.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if (value === selectedValue) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    return select;
  }

  /**
   * Creates a textarea element.
   */
  static createTextarea(placeholder: string, value = ""): HTMLTextAreaElement {
    const textarea = document.createElement("textarea");
    textarea.placeholder = placeholder;
    textarea.value = value;
    return textarea;
  }

  /**
   * Creates a label for a form control.
   */
  static createLabel(text: string, control: HTMLElement): HTMLElement {
    const label = this.createElement("label", "setting-item");
    const span = this.createElement("span", "setting-item-name");
    const controlWrapper = this.createElement("span", "setting-item-control");
    span.textContent = text;
    controlWrapper.appendChild(control);
    label.append(span, controlWrapper);
    return label;
  }

  /**
   * Creates a vertically stacked label for larger fields.
   */
  static createStackedLabel(text: string, control: HTMLElement): HTMLElement {
    const label = this.createElement("label", "leif-field-stack");
    const span = this.createElement("span", "leif-field-label");
    span.textContent = text;
    label.append(span, control);
    return label;
  }

  /**
   * Creates a full-width URL field with a quiet link affordance.
   */
  static createUrlField(text: string, input: HTMLInputElement): HTMLElement {
    const field = this.createElement("label", "leif-url-field");
    const label = this.createElement("span", "leif-field-label");
    const control = this.createElement("span", "leif-url-control");
    const icon = this.createIcon("link");
    icon.setAttribute("aria-hidden", "true");
    label.textContent = text;
    control.append(icon, input);
    field.append(label, control);
    return field;
  }

  /**
   * Creates a disclosure (details/summary) element.
   */
  static createDisclosure(title: string, content: HTMLElement, icon?: string): HTMLElement {
    const details = this.createElement("details", "leif-disclosure");
    const summary = this.createElement("summary", "leif-disclosure-summary");
    summary.appendChild(this.createTextWithIcon(title, icon));
    details.append(summary, content);
    return details;
  }

  /**
   * Creates a key-value row display.
   */
  static createKeyValueRow(label: string, value: string): HTMLElement {
    const row = this.createElement("div", "leif-key-value");
    const labelEl = this.createElement("span", "leif-key-label");
    labelEl.textContent = label;
    const valueEl = this.createElement("span", "leif-key-value-text");
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    return row;
  }

  /**
   * Creates a compact label/value metric for scannable list rows.
   */
  static createMetric(label: string, value: string): HTMLElement {
    const metric = this.createElement("div", "leif-metric");
    const labelEl = this.createElement("span", "leif-metric-label");
    labelEl.textContent = label;
    const valueEl = this.createElement("span", "leif-metric-value");
    valueEl.textContent = value;
    metric.append(labelEl, valueEl);
    return metric;
  }

  /**
   * Creates a table with headers and rows.
   * @param headers - Column headers
   * @param rows - Array of row data (each row is an array of cell content)
   */
  static createTable(headers: string[], rows: Array<Array<string | HTMLElement>>): HTMLElement {
    const wrapper = this.createElement("div", "leif-table-wrapper");
    const table = this.createElement("table", "leif-table");

    // Create header
    const thead = this.createElement("thead");
    const headerRow = this.createElement("tr");
    headers.forEach((header) => {
      const th = this.createElement("th");
      th.textContent = header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    const tbody = this.createElement("tbody");
    rows.forEach((rowData) => {
      const tr = this.createElement("tr");
      rowData.forEach((cellData) => {
        const td = this.createElement("td");
        if (typeof cellData === "string") {
          td.textContent = cellData;
        } else {
          td.appendChild(cellData);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrapper.appendChild(table);
    return wrapper;
  }

  /**
   * Creates a button with various options.
   */
  static createButton(
    text: string,
    options: {
      icon?: string;
      className?: string;
      dataset?: Record<string, string>;
      onClick?: (event: MouseEvent) => void | Promise<void>;
      type?: "button" | "submit" | "reset";
    } = {}
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = options.type || "button";
    button.className = options.className || "";

    if (options.icon) {
      button.appendChild(this.createTextWithIcon(text, options.icon));
    } else {
      button.textContent = text;
    }

    if (options.dataset) {
      Object.entries(options.dataset).forEach(([key, value]) => {
        button.dataset[key] = value;
      });
    }

    if (options.onClick) {
      button.addEventListener("click", options.onClick);
    }

    return button;
  }

  /**
   * Creates an icon-only button with a tooltip title.
   * @param icon - Icon key from ICON_NAMES
   * @param title - Tooltip text (shown on hover)
   * @param options - Additional options (className, dataset, onClick)
   * @returns HTMLButtonElement
   */
  static createIconButton(
    icon: string,
    title: string,
    options: {
      className?: string;
      dataset?: Record<string, string>;
      onClick?: (event: MouseEvent) => void | Promise<void>;
    } = {}
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = options.className || "clickable-icon";
    button.setAttribute("aria-label", title);
    button.appendChild(this.createIcon(icon));

    if (options.dataset) {
      Object.entries(options.dataset).forEach(([key, value]) => {
        button.dataset[key] = value;
      });
    }

    if (options.onClick) {
      button.addEventListener("click", options.onClick);
    }

    if (typeof setTooltip === "function") {
      setTooltip(button, title, { delay: 300 });
    } else {
      button.title = title;
    }

    return button;
  }

  /**
   * Creates a form element.
   */
  static createForm(onSubmit?: (event: Event) => void | Promise<void>): HTMLFormElement {
    const form = document.createElement("form");
    if (onSubmit) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        onSubmit(event);
      });
    }
    return form;
  }

  /**
   * Replaces all options in a select dropdown.
   * @param select - The select element to update
   * @param options - Array of [value, label] pairs
   * @param selectedValue - Optional value to pre-select
   */
  static replaceSelectOptions(
    select: HTMLSelectElement,
    options: Array<[string, string]>,
    selectedValue?: string
  ): void {
    select.innerHTML = "";
    options.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if (selectedValue !== undefined && value === selectedValue) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  /**
   * Creates a compact input for inline editing.
   */
  static createCompactInput(type: string, placeholder: string, value = ""): HTMLInputElement {
    const input = this.createInput(type, placeholder, value);
    input.size = 8;
    return input;
  }

  /**
   * Creates a table with inline CRUD support.
   * Returns a container with the table.
   */
  static createCrudTable(headers: string[]): {
    container: HTMLElement;
    tbody: HTMLElement;
  } {
    const container = this.createElement("div", "leif-table-wrapper");
    const table = this.createElement("table", "leif-table");

    const thead = this.createElement("thead");
    const headerRow = this.createElement("tr");
    headers.forEach((header) => {
      const th = this.createElement("th");
      th.textContent = header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = this.createElement("tbody");
    table.appendChild(tbody);
    container.appendChild(table);

    return { container, tbody };
  }

  /**
   * Creates a standard action cell with edit and delete buttons.
   */
  static createCrudActions(
    onEdit: () => void | Promise<void>,
    onDelete: () => void | Promise<void>
  ): HTMLElement {
    const actions = this.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(this.createIconButton("edit", t("action.edit"), { onClick: onEdit }));
    actions.appendChild(this.createIconButton("delete", t("action.delete"), { onClick: onDelete }));
    return actions;
  }

  /**
   * Creates a table cell with optional text or child element.
   */
  static createCell(text: string | null, element?: HTMLElement): HTMLElement {
    const td = this.createElement("td");
    if (text !== null) td.textContent = text;
    if (element) td.appendChild(element);
    return td;
  }

  /**
   * Creates an inline creation form card with cancel and submit actions.
   * @param title - Title for the form
   * @param onSubmit - Handler for form submission
   * @param onCancel - Handler for cancel action
   * @returns Form element
   */
  static createInlineForm(
    title: string,
    onSubmit: (event: Event) => void | Promise<void>,
    onCancel: () => void | Promise<void>
  ): HTMLElement {
    const card = this.createElement("section", "leif-card");
    card.appendChild(this.createSectionSubtitle(title, "add"));

    const form = this.createForm(onSubmit);
    const actions = this.createElement("div", "leif-form-actions");
    actions.appendChild(
      this.createButton(t("action.cancel"), {
        onClick: () => onCancel()
      })
    );
    actions.appendChild(
      this.createButton(t("action.create"), {
        type: "submit",
        className: "mod-cta"
      })
    );

    card.appendChild(form);
    card.appendChild(actions);
    return card;
  }

  /**
   * Displays an error notification using Obsidian's Notice.
   * Surfaces a friendlier message for NoActiveContestError.
   */
  static notifyError(error: unknown, fallbackMessage: string): void {
    if (error instanceof NoActiveContestError) {
      new Notice("Escolha um concurso para continuar.");
      return;
    }
    new Notice(error instanceof Error ? error.message : fallbackMessage);
  }

  /**
   * Error-boundary helper: runs an async action and surfaces any failure
   * through notifyError so callers don't repeat try/catch + Notice boilerplate.
   */
  static runGuarded(action: () => void | Promise<void>, fallbackMessage: string): Promise<void> {
    return (async () => {
      try {
        await action();
      } catch (error) {
        this.notifyError(error, fallbackMessage);
      }
    })();
  }

  /**
   * Creates a visual progress bar with a fill and a label.
   * @param readed - Pages readed
   * @param total - Total pages (optional)
   * @returns Progress container element
   */
  static createProgressBar(readed: number, total?: number): HTMLElement {
    const container = this.createElement("div", "leif-progress-bar-container");

    if (total !== undefined && total > 0) {
      const percentage = Math.min(100, Math.round((readed / total) * 100));
      const label = this.createElement("div", "leif-progress-label");
      const text = this.createElement("span", "leif-progress-value");
      text.textContent = `${readed}/${total} (${percentage}%)`;
      label.appendChild(text);

      if (readed >= total) {
        const complete = this.createElement("span", "leif-progress-complete");
        const completeText = this.createElement("span");
        completeText.textContent = "Concluído";
        complete.append(this.createIcon("check-circle-2"), completeText);
        label.appendChild(complete);
      } else {
        const bar = this.createElement("div", "leif-progress-bar");
        const fill = this.createElement("div", "leif-progress-fill");
        fill.style.width = `${percentage}%`;
        bar.setAttribute("role", "progressbar");
        bar.setAttribute("aria-valuemin", "0");
        bar.setAttribute("aria-valuemax", String(total));
        bar.setAttribute("aria-valuenow", String(Math.min(readed, total)));
        bar.appendChild(fill);
        container.appendChild(bar);
      }

      container.appendChild(label);
    } else {
      const label = this.createElement("div", "leif-progress-label");
      const value = this.createElement("span", "leif-progress-value");
      value.textContent = `${readed} lido${readed === 1 ? "" : "s"}`;
      label.appendChild(value);
      container.appendChild(label);
    }

    return container;
  }
}
