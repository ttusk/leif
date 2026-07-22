import { Component, MarkdownRenderer, Modal } from "obsidian";

import type { BundledReleaseNote } from "@/application/services/ChangelogService";

export class ChangelogModal extends Modal {
  private readonly rendererComponent = new Component();

  constructor(
    app: ConstructorParameters<typeof Modal>[0],
    private readonly release: BundledReleaseNote,
    private readonly acknowledge: () => Promise<void>
  ) {
    super(app);
  }

  override onOpen(): void {
    this.rendererComponent.load();
    this.contentEl.replaceChildren();
    this.contentEl.classList.add("leif-changelog");
    this.contentEl.appendChild(createElement("h1", this.release.title));

    const notes = createElement("div", undefined, "leif-changelog__notes");
    this.contentEl.appendChild(notes);
    void MarkdownRenderer.render(this.app, this.release.body, notes, "", this.rendererComponent);

    const actions = createElement("div", undefined, "leif-changelog__actions");
    this.contentEl.appendChild(actions);
    const githubLink = createElement("a", "Ver release no GitHub");
    githubLink.setAttribute("href", this.release.githubUrl);
    githubLink.setAttribute("target", "_blank");
    githubLink.setAttribute("rel", "noopener noreferrer");
    actions.appendChild(githubLink);

    const acknowledgeButton = createElement("button", "Entendi", "mod-cta");
    actions.appendChild(acknowledgeButton);
    acknowledgeButton.addEventListener("click", () => {
      acknowledgeButton.disabled = true;
      void this.acknowledge().then(() => this.close());
    });
  }

  override onClose(): void {
    this.rendererComponent.unload();
    this.contentEl.replaceChildren();
  }
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}
