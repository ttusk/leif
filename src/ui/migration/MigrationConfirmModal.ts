import { Modal, Notice } from "obsidian";

import { StagedMarkdownMigrationService } from "@/application/services/StagedMarkdownMigrationService";

export class MigrationConfirmModal extends Modal {
  constructor(
    app: ConstructorParameters<typeof Modal>[0],
    private readonly contestName: string,
    private readonly contestId: string,
    private readonly migration: StagedMarkdownMigrationService
  ) {
    super(app);
  }

  override onOpen(): void {
    this.contentEl.replaceChildren();
    this.contentEl.classList.add("leif-migration");
    this.contentEl.appendChild(element("h1", "Migrar concurso para Markdown"));
    this.contentEl.appendChild(
      element(
        "p",
        `Leif criará um backup imutável de “${this.contestName}”, escreverá uma prévia em staging e só trocará a fonte após reler e verificar todos os dados.`
      )
    );
    this.contentEl.appendChild(
      element(
        "p",
        "O JSON legado será mantido para recuperação. Arquivos existentes nunca serão sobrescritos."
      )
    );

    const actions = element("div", undefined, "leif-migration__actions");
    const cancel = element("button", "Cancelar");
    cancel.addEventListener("click", () => this.close());
    const confirm = element("button", "Criar backup e migrar", "mod-cta");
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      cancel.disabled = true;
      void this.migration
        .migrate(this.contestId)
        .then(() => {
          new Notice("Migração concluída. O Markdown agora é a fonte deste concurso.");
          this.close();
        })
        .catch((error: unknown) => {
          confirm.disabled = false;
          cancel.disabled = false;
          new Notice(
            `Migração não realizada: ${error instanceof Error ? error.message : String(error)}`
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
