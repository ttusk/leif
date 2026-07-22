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

  override async createFolder(path: string) {
    if (path === "Leif" && super.getAbstractFileByPath(path)) {
      throw new Error("Folder already exists.");
    }
    return super.createFolder(path);
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

  it("uses the data adapter for dot-folders omitted from the Vault index", async () => {
    const files = new Map<string, string>();
    const folders = new Set<string>(["Leif", "Leif/.staging"]);
    const adapter = {
      exists: async (path: string) => files.has(path) || folders.has(path),
      read: async (path: string) => files.get(path) ?? "",
      write: async (path: string, content: string) => {
        files.set(path, content);
      },
      mkdir: async (path: string) => {
        folders.add(path);
      },
      list: async (path: string) => ({
        files: [...files.keys()].filter(
          (candidate) => candidate.startsWith(`${path}/`) && !candidate.slice(path.length + 1).includes("/")
        ),
        folders: [...folders].filter(
          (candidate) => candidate.startsWith(`${path}/`) && !candidate.slice(path.length + 1).includes("/")
        )
      }),
      rename: async (source: string, destination: string) => {
        for (const [path, content] of [...files]) {
          if (path !== source && !path.startsWith(`${source}/`)) continue;
          files.delete(path);
          files.set(`${destination}${path.slice(source.length)}`, content);
        }
      }
    };
    const vault = {
      adapter,
      getAbstractFileByPath: () => null,
      getFiles: () => []
    } as unknown as Vault;
    const store = new ObsidianMarkdownFileStore(vault);
    const staged = "Leif/.staging/run/concursos/trt/concurso.md";

    await store.writeNew(staged, "# TRT\n");

    expect(await store.exists(staged)).toBe(true);
    expect(await store.read(staged)).toBe("# TRT\n");
    expect(await store.list("Leif/.staging")).toEqual([staged]);

    await store.move("Leif/.staging/run/concursos/trt", "Leif/concursos/trt");
    expect(await store.exists("Leif/concursos/trt/concurso.md")).toBe(true);
  });
});
