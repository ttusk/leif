import { describe, expect, it } from "vitest";

import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import { MarkdownContestBundleCodec } from "@/infrastructure/markdown/MarkdownContestBundleCodec";
import { MarkdownContestWriter } from "@/infrastructure/markdown/MarkdownContestWriter";

class MemoryFiles implements MarkdownFileStore {
  readonly files = new Map<string, string>();
  onFirstStagedWrite?: () => void;
  private stagedWriteObserved = false;
  async exists(path: string): Promise<boolean> {
    return (
      this.files.has(path) || [...this.files.keys()].some((file) => file.startsWith(`${path}/`))
    );
  }
  async writeNew(path: string, content: string): Promise<void> {
    if (this.files.has(path)) throw new Error("exists");
    this.files.set(path, content);
    if (!this.stagedWriteObserved && path.includes("/.staging/write-")) {
      this.stagedWriteObserved = true;
      this.onFirstStagedWrite?.();
    }
  }
  async read(path: string): Promise<string> {
    return this.files.get(path)!;
  }
  async list(prefix: string): Promise<string[]> {
    return [...this.files.keys()].filter((path) => path.startsWith(`${prefix}/`));
  }
  async move(source: string, destination: string): Promise<void> {
    const entries = [...this.files].filter(
      ([path]) => path === source || path.startsWith(`${source}/`)
    );
    for (const [path, content] of entries) {
      this.files.delete(path);
      this.files.set(`${destination}${path.slice(source.length)}`, content);
    }
  }
}

function data() {
  const value = createDefaultLeifPluginData();
  value.contests.push({
    id: "contest-1",
    name: "TRT",
    subjectIds: ["subject-1"],
    wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
  });
  value.subjects.push({
    id: "subject-1",
    contestId: "contest-1",
    name: "Português",
    order: 1,
    isActive: true,
    plannedStudyMinutes: 60,
    itemIds: [],
    topicIds: []
  });
  return value;
}

describe("MarkdownContestWriter", () => {
  it("stages, verifies and swaps UI changes while preserving user-owned Markdown", async () => {
    const files = new MemoryFiles();
    const codec = new MarkdownContestBundleCodec();
    const initial = data();
    const encoded = codec.encode(initial, "contest-1");
    encoded.forEach((file) => files.files.set(file.path, file.content));
    const subjectPath = encoded.find((file) => file.path.includes("/materias/"))!.path;
    files.files.set(
      subjectPath,
      files.files.get(subjectPath)!.replace("---\n#", "custom-agent-field: keep\n---\n#") +
        "\n## Minhas notas\nNão apagar.\n"
    );
    const contestRoot = subjectPath.split("/materias/")[0];
    files.files.set(`${contestRoot}/anexos/leitura.txt`, "conteúdo externo");

    const updated = data();
    updated.subjects[0] = {
      ...updated.subjects[0],
      name: "Língua Portuguesa",
      plannedStudyMinutes: 75
    };
    const writer = new MarkdownContestWriter(files, () => new Date("2026-07-21T21:00:00Z"));

    await writer.sync(updated, "contest-1", "Leif");

    const finalSubject = files.files.get(subjectPath)!;
    expect(finalSubject).toContain('name: "Língua Portuguesa"');
    expect(finalSubject).toContain("planned-minutes: 75");
    expect(finalSubject).toContain("custom-agent-field: keep");
    expect(finalSubject).toContain("Não apagar.");
    expect(files.files.get(`${contestRoot}/anexos/leitura.txt`)).toBe("conteúdo externo");
    expect([...files.files.keys()].some((path) => path.includes("/.backups/writes/"))).toBe(true);
  });

  it("aborts before swapping when an agent edits source Markdown during staging", async () => {
    const files = new MemoryFiles();
    const codec = new MarkdownContestBundleCodec();
    const initial = data();
    const encoded = codec.encode(initial, "contest-1");
    encoded.forEach((file) => files.files.set(file.path, file.content));
    const subjectPath = encoded.find((file) => file.path.includes("/materias/"))!.path;
    files.onFirstStagedWrite = () => {
      files.files.set(
        subjectPath,
        files.files.get(subjectPath)!.replace("# Português", "# Edição concorrente do agente")
      );
    };
    const updated = data();
    updated.subjects[0] = { ...updated.subjects[0], name: "Língua Portuguesa" };

    await expect(
      new MarkdownContestWriter(files).sync(updated, "contest-1", "Leif")
    ).rejects.toThrow(/changed while Leif was preparing the write/i);

    expect(files.files.get(subjectPath)).toContain("Edição concorrente do agente");
    expect(files.files.get(subjectPath)).not.toContain('name: "Língua Portuguesa"');
    expect([...files.files.keys()].some((path) => path.includes("/.backups/writes/"))).toBe(false);
  });
});
