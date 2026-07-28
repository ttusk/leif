import { App, Modal } from "obsidian";

export class BackupRecoveryPickerModal extends Modal {
  constructor(
    app: App,
    private readonly backups: readonly string[],
    private readonly onChoose: (backupPath: string) => void | Promise<void>
  ) {
    super(app);
  }

  override onOpen(): void {
    this.contentEl.replaceChildren();
    const title = createEl("h2", { cls: "leif-recovery-picker-title" });
    title.textContent = "Recuperar backup";
    const list = createDiv({ cls: "leif-recovery-picker-list" });

    this.backups.forEach((backupPath) => {
      const button = createEl("button", { cls: "leif-recovery-picker-option" });
      button.type = "button";
      button.textContent = backupPath;
      button.addEventListener("click", () => {
        this.close();
        void this.onChoose(backupPath);
      });
      list.appendChild(button);
    });

    this.contentEl.append(title, list);
  }
}
