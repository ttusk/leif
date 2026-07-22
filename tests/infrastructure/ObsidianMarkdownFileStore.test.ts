import { describe, expect, it } from "vitest";
import { Vault } from "obsidian";

import { ObsidianMarkdownFileStore } from "@/infrastructure/obsidian/ObsidianMarkdownFileStore";

describe("ObsidianMarkdownFileStore", () => {
  it("continues when Obsidian reports an existing parent after a stale lookup", async () => {
    const files = new Map<string, string>();
    const folders = new Set<string>(["Leif"]);
    let hideExistingFolder = true;
    const vault = {
      adapter: {
        exists: async (path: string) => {
          if (path === "Leif" && hideExistingFolder) {
            hideExistingFolder = false;
            return false;
          }
          return files.has(path) || folders.has(path);
        },
        mkdir: async (path: string) => {
          if (folders.has(path)) throw new Error("Folder already exists.");
          folders.add(path);
        },
        write: async (path: string, content: string) => {
          files.set(path, content);
        }
      }
    } as unknown as Vault;
    const store = new ObsidianMarkdownFileStore(vault);

    await expect(store.writeNew("Leif/README.md", "# Leif\n")).resolves.toBeUndefined();
    expect(files.get("Leif/README.md")).toBe("# Leif\n");
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
          (candidate) =>
            candidate.startsWith(`${path}/`) && !candidate.slice(path.length + 1).includes("/")
        ),
        folders: [...folders].filter(
          (candidate) =>
            candidate.startsWith(`${path}/`) && !candidate.slice(path.length + 1).includes("/")
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
