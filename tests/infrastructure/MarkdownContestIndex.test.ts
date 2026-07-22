import { describe, expect, it } from "vitest";

import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import { MarkdownContestBundleCodec } from "@/infrastructure/markdown/MarkdownContestBundleCodec";
import { MarkdownContestIndex } from "@/infrastructure/markdown/MarkdownContestIndex";

class MemoryFiles implements MarkdownFileStore {
  readonly files = new Map<string, string>();
  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
  async writeNew(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
  async read(path: string): Promise<string> {
    return this.files.get(path)!;
  }
  async list(prefix: string): Promise<string[]> {
    return [...this.files.keys()].filter((path) => path.startsWith(`${prefix}/`));
  }
  async move(): Promise<void> {}
}

function source() {
  const data = createDefaultLeifPluginData();
  data.contests.push({
    id: "contest-1",
    name: "TRT",
    subjectIds: [],
    wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
  });
  return data;
}

describe("MarkdownContestIndex", () => {
  it("isolates invalid concursos and retains their last-known-good projection", async () => {
    const files = new MemoryFiles();
    const codec = new MarkdownContestBundleCodec();
    const encoded = codec.encode(source(), "contest-1");
    encoded.forEach((file) => files.files.set(file.path, file.content));
    const root = encoded[0].path.slice(0, -"/concurso.md".length);
    files.files.set(`${root}/minhas-notas.md`, "# Nota livre\n\nNão gerenciada pelo Leif.\n");
    const index = new MarkdownContestIndex(files);

    const first = await index.refresh("Leif");
    expect(first.contests.map((contest) => contest.id)).toEqual(["contest-1"]);
    expect(first.diagnostics).toHaveLength(0);

    const contestPath = encoded.find((file) => file.path.endsWith("/concurso.md"))!.path;
    files.files.set(contestPath, `${files.files.get(contestPath)}\n<<<<<<< HEAD\n`);
    const second = await index.refresh("Leif");

    expect(second.contests.map((contest) => contest.id)).toEqual(["contest-1"]);
    expect(second.diagnostics).toEqual([
      expect.objectContaining({ path: contestPath, code: "merge-conflict" })
    ]);
  });
});
