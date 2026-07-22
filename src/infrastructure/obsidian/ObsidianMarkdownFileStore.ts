import { normalizePath, TFile, Vault } from "obsidian";

import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";

export class ObsidianMarkdownFileStore implements MarkdownFileStore {
  constructor(private readonly vault: Vault) {}

  async exists(path: string): Promise<boolean> {
    return this.vault.getAbstractFileByPath(normalizePath(path)) !== null;
  }

  async writeNew(path: string, content: string): Promise<void> {
    const normalized = normalizePath(path);
    if (await this.exists(normalized)) {
      throw new Error(`Leif will not overwrite existing path "${normalized}".`);
    }
    await this.ensureParentFolder(normalized);
    await this.vault.create(normalized, content);
  }

  async read(path: string): Promise<string> {
    const normalized = normalizePath(path);
    const file = this.vault.getAbstractFileByPath(normalized);
    if (!(file instanceof TFile)) {
      throw new Error(`Expected file "${normalized}".`);
    }
    return this.vault.read(file);
  }

  async list(prefix: string): Promise<string[]> {
    const normalized = normalizePath(prefix);
    return this.vault
      .getFiles()
      .map((file) => file.path)
      .filter((path) => path.startsWith(`${normalized}/`));
  }

  async move(source: string, destination: string): Promise<void> {
    const normalizedSource = normalizePath(source);
    const normalizedDestination = normalizePath(destination);
    const entry = this.vault.getAbstractFileByPath(normalizedSource);
    if (!entry) throw new Error(`Migration staging path "${normalizedSource}" is missing.`);
    if (await this.exists(normalizedDestination)) {
      throw new Error(`Leif will not overwrite existing path "${normalizedDestination}".`);
    }
    await this.ensureParentFolder(normalizedDestination);
    await this.vault.rename(entry, normalizedDestination);
  }

  private async ensureParentFolder(path: string): Promise<void> {
    const segments = path.split("/").slice(0, -1);
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!this.vault.getAbstractFileByPath(current)) {
        await this.vault.createFolder(current);
      }
    }
  }
}
