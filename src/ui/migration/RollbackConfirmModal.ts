import { Modal, Notice } from "obsidian";

import { MarkdownRollbackService } from "@/application/services/MarkdownRollbackService";

export class RollbackConfirmModal extends Modal {
  constructor(
    app: ConstructorParameters<typeof Modal>[0],
    private readonly contestName: string,
    private readonly contestId: string,
    private readonly rollback: MarkdownRollbackService
  ) {
    super(app);
  }

  override onOpen(): void {
    this.contentEl.replaceChildren();
    this.contentEl.classList.add("leif-migration");
    this.contentEl.appendChild(element("h1", "Voltar ao armazenamento legado"));
    this.contentEl.appendChild(
      element(
        "p",
        `“${this.contestName}” voltará ao snapshot JSON anterior à migração. Os arquivos Markdown serão preservados, mas deixarão de ser a fonte ativa.`
      )
    );
    this.contentEl.appendChild(
      element(
        "p",
        "Leif bloqueará a operação se o JSON legado tiver sido alterado por sync ou por uma versão anterior."
      )
    );
    const actions = element("div", undefined, "leif-migration__actions");
    const cancel = element("button", "Cancelar");
    cancel.addEventListener("click", () => this.close());
    const confirm = element("button", "Voltar ao JSON legado", "mod-warning");
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      cancel.disabled = true;
      void this.rollback
        .rollback(this.contestId)
        .then(() => {
          new Notice("Rollback concluído. Os arquivos Markdown foram preservados.");
          this.close();
        })
        .catch((error: unknown) => {
          confirm.disabled = false;
          cancel.disabled = false;
          new Notice(
            `Rollback bloqueado: ${error instanceof Error ? error.message : String(error)}`
          );
        });
    });
    actions.append(cancel, confirm);
    this.contentEl.appendChild(actions);
  }

  override onClose(): void {
    this.contentEl.replaceChildren();
  }
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (text) result.textContent = text;
  if (className) result.className = className;
  return result;
}
