import { Notice, setIcon, setTooltip } from "obsidian";
import { ICON_NAMES } from "@/ui/constants";
import { NoActiveContestError } from "@/domain/errors/DomainErrors";

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
    input.className = "leif-input";
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
    select.className = "leif-select";

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
    textarea.className = "leif-textarea";
    return textarea;
  }

  /**
   * Creates a label for a form control.
   */
  static createLabel(text: string, control: HTMLElement): HTMLElement {
    const label = this.createElement("label", "leif-label");
    const span = this.createElement("span", "leif-label-text");
    span.textContent = text;
    label.append(span, control);
    return label;
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
    button.className = options.className || "leif-button";

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
    button.className = options.className || "leif-icon-button";
    button.setAttribute("aria-label", title);
    button.appendChild(this.createIcon(icon, "leif-icon-button-icon"));

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
    return this.createElement("div", "leif-button-group");
  }

  /**
   * Creates a form element.
   */
  static createForm(onSubmit?: (event: Event) => void | Promise<void>): HTMLFormElement {
    const form = document.createElement("form");
    form.className = "leif-form";
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
    input.className = "leif-input leif-input-compact";
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
    actions.appendChild(
      this.createIconButton("edit", "Editar", { onClick: onEdit })
    );
    actions.appendChild(
      this.createIconButton("delete", "Excluir", { onClick: onDelete })
    );
    return actions;
  }

  /**
   * Creates a form row for organizing form elements.
   */
  static createFormRow(): HTMLElement {
    return this.createElement("div", "leif-form-row");
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
    const card = this.createElement("section", "leif-card leif-create-form");
    card.appendChild(this.createSectionSubtitle(title, "add"));

    const form = this.createForm(onSubmit);
    const actions = this.createElement("div", "leif-form-actions");
    actions.appendChild(
      this.createButton("Cancelar", {
        className: "leif-button",
        onClick: () => onCancel()
      })
    );
    actions.appendChild(
      this.createButton("Criar", {
        type: "submit",
        className: "leif-primary-button"
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
      new Notice("Nenhum concurso ativo. Selecione um concurso para continuar.");
      return;
    }
    new Notice(error instanceof Error ? error.message : fallbackMessage);
  }

  /**
   * Error-boundary helper: runs an async action and surfaces any failure
   * through notifyError so callers don't repeat try/catch + Notice boilerplate.
   */
  static runGuarded(
    action: () => void | Promise<void>,
    fallbackMessage: string
  ): Promise<void> {
    return (async () => {
      try {
        await action();
      } catch (error) {
        this.notifyError(error, fallbackMessage);
      }
    })();
  }

  /**
   * Creates a modal overlay with a centered card.
   * Implements role=dialog, aria-modal, a focus trap and Escape-to-close.
   * Returns { open, close } functions.
   */
  static createModal(options: {
    title: string;
    content: HTMLElement;
    onSubmit: () => void | Promise<void>;
    onCancel?: () => void;
    submitLabel?: string;
  }): { open: () => void; close: () => void } {
    const overlay = this.createElement("div", "leif-modal-overlay");
    const card = this.createElement("div", "leif-modal-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");

    const titleId = `leif-modal-title-${Math.random().toString(36).slice(2, 9)}`;
    card.setAttribute("aria-labelledby", titleId);

    const header = this.createElement("div", "leif-modal-header");
    const title = this.createElement("h3", "leif-modal-title");
    title.id = titleId;
    title.textContent = options.title;
    const closeButton = this.createIconButton("x", "Fechar", {
      onClick: () => close()
    });
    header.appendChild(title);
    header.appendChild(closeButton);

    const body = this.createElement("div", "leif-modal-body");
    body.appendChild(options.content);

    const footer = this.createElement("div", "leif-modal-footer");
    const cancelButton = this.createButton("Cancelar", {
      className: "leif-button",
      dataset: { leifConfirm: "cancel" },
      onClick: () => close()
    });
    const submitButton = this.createButton(options.submitLabel ?? "Criar", {
      className: "leif-primary-button",
      dataset: { leifConfirm: "submit" },
      onClick: () => options.onSubmit()
    });
    footer.appendChild(cancelButton);
    footer.appendChild(submitButton);

    card.append(header, body, footer);
    overlay.appendChild(card);

    let previouslyFocused: HTMLElement | null = null;
    let focusTrapHandler: ((event: KeyboardEvent) => void) | null = null;
    let escapeHandler: ((event: KeyboardEvent) => void) | null = null;

    const focusable = (): HTMLElement[] => {
      const elements = card.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(elements).filter((element) => !element.hasAttribute("disabled"));
    };

    const open = (): void => {
      previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      document.body.appendChild(overlay);
      const first = focusable()[0] ?? card;
      first.focus();

      focusTrapHandler = (event: KeyboardEvent): void => {
        if (event.key !== "Tab") return;
        const elements = focusable();
        if (elements.length === 0) {
          event.preventDefault();
          return;
        }
        const firstEl = elements[0];
        const lastEl = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault();
          lastEl.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      };

      escapeHandler = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      };

      card.addEventListener("keydown", focusTrapHandler);
      overlay.addEventListener("keydown", escapeHandler);
    };

    const close = (): void => {
      if (focusTrapHandler) card.removeEventListener("keydown", focusTrapHandler);
      if (escapeHandler) overlay.removeEventListener("keydown", escapeHandler);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      previouslyFocused?.focus();
      options.onCancel?.();
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close();
      }
    });

    return { open, close };
  }

  /**
   * Creates an accessible confirmation dialog (replaces native window.confirm).
   * Resolves the returned promise with true when confirmed, false when cancelled.
   */
  static confirm(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const settle = (value: boolean): void => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };

      const message = this.createElement("p", "leif-modal-message");
      message.textContent = options.message;

      const modal = this.createModal({
        title: options.title,
        content: message,
        submitLabel: options.confirmLabel ?? "Confirmar",
        onSubmit: () => {
          settle(true);
          modal.close();
        },
        onCancel: () => settle(false)
      });

      modal.open();
    });
  }

  /**
   * Creates a visual progress bar with a fill and a label.
   * @param readed - Pages readed
   * @param total - Total pages (optional)
   * @returns Progress container element
   */
  static createProgressBar(readed: number, total?: number): HTMLElement {
    const container = this.createElement("div", "leif-progress-bar-container");

    const bar = this.createElement("div", "leif-progress-bar");
    const fill = this.createElement("div", "leif-progress-fill");

    if (total !== undefined && total > 0) {
      const percentage = Math.min(100, Math.round((readed / total) * 100));
      fill.style.width = `${percentage}%`;

      if (readed >= total) {
        fill.classList.add("is-complete");
      }

      const label = this.createElement("div", "leif-progress-label");
      const text = this.createElement("span", "leif-progress-value");
      text.textContent = `${readed}/${total} (${percentage}%)`;
      label.appendChild(text);
      container.appendChild(bar);
      container.appendChild(label);
    } else {
      const label = this.createElement("div", "leif-progress-label");
      const value = this.createElement("span", "leif-progress-value");
      value.textContent = `${readed} lido${readed === 1 ? "" : "s"}`;
      label.appendChild(value);
      container.appendChild(label);
    }

    bar.appendChild(fill);
    return container;
  }
}
