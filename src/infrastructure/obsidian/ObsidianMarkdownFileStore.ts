import { normalizePath, Vault } from "obsidian";

import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";

export class ObsidianMarkdownFileStore implements MarkdownFileStore {
  constructor(private readonly vault: Vault) {}

  async exists(path: string): Promise<boolean> {
    return this.vault.adapter.exists(normalizePath(path));
  }

  async writeNew(path: string, content: string): Promise<void> {
    const normalized = normalizePath(path);
    if (await this.exists(normalized)) {
      throw new Error(`Leif will not overwrite existing path "${normalized}".`);
    }
    await this.ensureParentFolder(normalized);
    await this.vault.adapter.write(normalized, content);
  }

  async read(path: string): Promise<string> {
    const normalized = normalizePath(path);
    if (!(await this.vault.adapter.exists(normalized))) {
      throw new Error(`Expected file "${normalized}".`);
    }
    return this.vault.adapter.read(normalized);
  }

  async list(prefix: string): Promise<string[]> {
    const normalized = normalizePath(prefix);
    if (!(await this.vault.adapter.exists(normalized))) return [];
    const files: string[] = [];
    const pending = [normalized];
    while (pending.length > 0) {
      const folder = pending.pop()!;
      const listed = await this.vault.adapter.list(folder);
      files.push(...listed.files);
      pending.push(...listed.folders);
    }
    return files.sort((left, right) => left.localeCompare(right));
  }

  async move(source: string, destination: string): Promise<void> {
    const normalizedSource = normalizePath(source);
    const normalizedDestination = normalizePath(destination);
    if (!(await this.vault.adapter.exists(normalizedSource))) {
      throw new Error(`Migration staging path "${normalizedSource}" is missing.`);
    }
    if (await this.exists(normalizedDestination)) {
      throw new Error(`Leif will not overwrite existing path "${normalizedDestination}".`);
    }
    await this.ensureParentFolder(normalizedDestination);
    await this.vault.adapter.rename(normalizedSource, normalizedDestination);
  }

  private async ensureParentFolder(path: string): Promise<void> {
    const segments = path.split("/").slice(0, -1);
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (await this.vault.adapter.exists(current)) continue;
      try {
        await this.vault.adapter.mkdir(current);
      } catch (error) {
        if (!(await this.vault.adapter.exists(current))) throw error;
      }
    }
  }
}
