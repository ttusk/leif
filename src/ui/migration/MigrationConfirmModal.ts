import { Modal, Notice } from "obsidian";

import {
  StagedMarkdownMigrationService,
  type MigrationPreview
} from "@/application/services/StagedMarkdownMigrationService";

export class MigrationConfirmModal extends Modal {
  constructor(
    app: ConstructorParameters<typeof Modal>[0],
    private readonly contestName: string,
    private readonly contestId: string,
    private readonly preview: MigrationPreview,
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

    this.contentEl.appendChild(element("h2", "Prévia da migração"));
    this.contentEl.appendChild(
      element(
        "p",
        `${this.preview.files.length} ${this.preview.files.length === 1 ? "arquivo" : "arquivos"} serão criados.`
      )
    );
    const files = element("ul", undefined, "leif-migration__file-list");
    this.preview.files.forEach((path) => files.appendChild(element("li", path)));
    const fileDisclosure = element("details", undefined, "leif-migration__files");
    const fileSummary = element(
      "summary",
      `Ver ${this.preview.files.length} ${this.preview.files.length === 1 ? "arquivo" : "arquivos"}`
    );
    fileDisclosure.append(fileSummary, files);
    this.contentEl.appendChild(fileDisclosure);

    if (this.preview.blocked) {
      this.contentEl.appendChild(element("h2", "Migração bloqueada"));
      const diagnostics = element("ul", undefined, "leif-migration__diagnostics");
      this.preview.diagnostics.forEach((diagnostic) => {
        diagnostics.appendChild(element("li", diagnostic.message));
      });
      this.contentEl.appendChild(diagnostics);
    }

    const actions = element("div", undefined, "leif-migration__actions");
    const cancel = element("button", "Cancelar");
    cancel.addEventListener("click", () => this.close());
    const confirm = element("button", "Criar backup e migrar", "mod-cta");
    confirm.disabled = this.preview.blocked;
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
