import { Modal, type App } from "obsidian";

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmLabel: string;
}

export class ConfirmationModal extends Modal {
  private settled = false;

  private constructor(
    app: App,
    private readonly options: ConfirmationOptions,
    private readonly resolveConfirmation: (confirmed: boolean) => void
  ) {
    super(app);
  }

  static ask(app: App, options: ConfirmationOptions): Promise<boolean> {
    return new Promise((resolve) => {
      new ConfirmationModal(app, options, resolve).open();
    });
  }

  override onOpen(): void {
    this.contentEl.replaceChildren();
    this.contentEl.classList.add("leif-confirmation");

    const title = createEl("h2");
    title.textContent = this.options.title;
    const message = createEl("p");
    message.textContent = this.options.message;

    const actions = createEl("div");
    actions.className = "leif-confirmation__actions";

    const cancel = createEl("button");
    cancel.type = "button";
    cancel.textContent = "Cancelar";
    cancel.dataset.confirmationCancel = "true";
    cancel.addEventListener("click", () => {
      this.finish(false);
    });

    const confirm = createEl("button");
    confirm.type = "button";
    confirm.className = "mod-warning";
    confirm.textContent = this.options.confirmLabel;
    confirm.dataset.confirmationConfirm = "true";
    confirm.addEventListener("click", () => {
      this.finish(true);
    });

    actions.append(cancel, confirm);
    this.contentEl.append(title, message, actions);
    cancel.focus();
  }

  override onClose(): void {
    this.contentEl.replaceChildren();
    if (this.settled) return;
    this.settled = true;
    this.resolveConfirmation(false);
  }

  private finish(confirmed: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolveConfirmation(confirmed);
    this.close();
  }
}
