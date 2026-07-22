import { describe, expect, it } from "vitest";
import { TAbstractFile, Vault } from "obsidian";

import { ObsidianMarkdownFileStore } from "@/infrastructure/obsidian/ObsidianMarkdownFileStore";

class EventuallyConsistentFolderVault extends Vault {
  private hideExistingFolder = true;

  override getAbstractFileByPath(path: string): TAbstractFile | null {
    if (path === "Leif" && this.hideExistingFolder) {
      this.hideExistingFolder = false;
      return null;
    }
    return super.getAbstractFileByPath(path);
  }

  override async createFolder(path: string): Promise<void> {
    if (path === "Leif" && super.getAbstractFileByPath(path)) {
      throw new Error("Folder already exists.");
    }
    await super.createFolder(path);
  }
}

describe("ObsidianMarkdownFileStore", () => {
  it("continues when Obsidian reports an existing parent after a stale lookup", async () => {
    const vault = new EventuallyConsistentFolderVault();
    await vault.createFolder("Leif");
    const store = new ObsidianMarkdownFileStore(vault);

    await expect(store.writeNew("Leif/README.md", "# Leif\n")).resolves.toBeUndefined();
    expect(vault.getAbstractFileByPath("Leif/README.md")).not.toBeNull();
  });
});
