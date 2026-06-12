import { setIcon, setTooltip } from "obsidian";
import { ICON_NAMES } from "@/ui/constants";

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
  static createIcon(iconKey: string, className = "corvo-icon"): HTMLElement {
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
    const wrapper = this.createElement("span", "corvo-text-with-icon");
    if (icon) {
      wrapper.appendChild(this.createIcon(icon));
    }
    const label = this.createElement("span", "corvo-text-label");
    label.textContent = text;
    wrapper.appendChild(label);
    return wrapper;
  }

  /**
   * Creates an H1 heading with optional icon.
   */
  static createHeading(text: string, icon?: string): HTMLElement {
    const heading = this.createElement("h1", "corvo-title");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }

  /**
   * Creates an H2 section title with optional icon.
   */
  static createSectionTitle(text: string, icon?: string): HTMLElement {
    const heading = this.createElement("h2", "corvo-section-title");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }

  /**
   * Creates an H3 section subtitle with optional icon.
   */
  static createSectionSubtitle(text: string, icon?: string): HTMLElement {
    const heading = this.createElement("h3", "corvo-section-subtitle");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }

  /**
   * Creates a paragraph element.
   */
  static createParagraph(text: string): HTMLElement {
    const paragraph = this.createElement("p", "corvo-paragraph");
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
    const badge = this.createElement("span", "corvo-badge");
    badge.appendChild(this.createTextWithIcon(text, icon));
    return badge;
  }

  /**
   * Creates a card section with title and optional icon.
   */
  static createCard(title: string, icon?: string): HTMLElement {
    const card = this.createElement("section", "corvo-card");
    card.appendChild(this.createSectionSubtitle(title, icon));
    return card;
  }

  /**
   * Creates an empty state message.
   */
  static createEmptyState(title: string, description: string): HTMLElement {
    const wrapper = this.createElement("section", "corvo-empty-state corvo-card");
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
    input.className = "corvo-input";
    return input;
  }

  /**
   * Creates a select dropdown with options.
   * @param options - Array of [value, label] pairs
   * @param selectedValue - Optional value to pre-select
   */
  static createSelect(
    options: Array<[string, string]>,
    selectedValue?: string
  ): HTMLSelectElement {
    const select = document.createElement("select");
    select.className = "corvo-select";

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
    textarea.className = "corvo-textarea";
    return textarea;
  }

  /**
   * Creates a label for a form control.
   */
  static createLabel(text: string, control: HTMLElement): HTMLElement {
    const label = this.createElement("label", "corvo-label");
    const span = this.createElement("span", "corvo-label-text");
    span.textContent = text;
    label.append(span, control);
    return label;
  }

  /**
   * Creates a disclosure (details/summary) element.
   */
  static createDisclosure(title: string, content: HTMLElement, icon?: string): HTMLElement {
    const details = this.createElement("details", "corvo-disclosure");
    const summary = this.createElement("summary", "corvo-disclosure-summary");
    summary.appendChild(this.createTextWithIcon(title, icon));
    details.append(summary, content);
    return details;
  }

  /**
   * Creates a key-value row display.
   */
  static createKeyValueRow(label: string, value: string): HTMLElement {
    const row = this.createElement("div", "corvo-key-value");
    const labelEl = this.createElement("span", "corvo-key-label");
    labelEl.textContent = label;
    const valueEl = this.createElement("span", "corvo-key-value-text");
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    return row;
  }

  /**
   * Creates a table with headers and rows.
   * @param headers - Column headers
   * @param rows - Array of row data (each row is an array of cell content)
   */
  static createTable(headers: string[], rows: Array<Array<string | HTMLElement>>): HTMLElement {
    const wrapper = this.createElement("div", "corvo-table-wrapper");
    const table = this.createElement("table", "corvo-table");

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
    button.className = options.className || "corvo-button";

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
    button.className = options.className || "corvo-icon-button";
    button.appendChild(this.createIcon(icon, "corvo-icon-button-icon"));

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
   * Creates a button group container.
   */
  static createButtonGroup(): HTMLElement {
    return this.createElement("div", "corvo-button-group");
  }

  /**
   * Creates a form element.
   */
  static createForm(onSubmit?: (event: Event) => void | Promise<void>): HTMLFormElement {
    const form = document.createElement("form");
    form.className = "corvo-form";
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
   * Creates a form row for organizing form elements.
   */
  static createFormRow(): HTMLElement {
    return this.createElement("div", "corvo-form-row");
  }
}
