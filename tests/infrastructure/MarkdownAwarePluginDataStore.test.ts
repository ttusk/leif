import { describe, expect, it } from "vitest";

import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { MarkdownContestBundleCodec } from "@/infrastructure/markdown/MarkdownContestBundleCodec";
import { MarkdownContestIndex } from "@/infrastructure/markdown/MarkdownContestIndex";
import { MarkdownContestWriter } from "@/infrastructure/markdown/MarkdownContestWriter";
import { MigrationSafetyService } from "@/application/services/MigrationSafetyService";
import { MarkdownAwarePluginDataStore } from "@/infrastructure/persistence/MarkdownAwarePluginDataStore";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";

class MemoryAdapter implements PersistentStorageAdapter<LeifPluginData> {
  constructor(public data: LeifPluginData) {}
  async load(): Promise<LeifPluginData> {
    return structuredClone(this.data);
  }
  async save(data: LeifPluginData): Promise<void> {
    this.data = structuredClone(data);
  }
}

class MemoryFiles implements MarkdownFileStore {
  readonly files = new Map<string, string>();
  async exists(path: string): Promise<boolean> {
    return (
      this.files.has(path) || [...this.files.keys()].some((file) => file.startsWith(`${path}/`))
    );
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
  async move(source: string, destination: string): Promise<void> {
    for (const [path, content] of [...this.files]) {
      if (path === source || path.startsWith(`${source}/`)) {
        this.files.delete(path);
        this.files.set(`${destination}${path.slice(source.length)}`, content);
      }
    }
  }
}

function storedData(): LeifPluginData {
  const data = createDefaultLeifPluginData();
  data.activeContestId = "contest-1";
  data.contests.push({
    id: "contest-1",
    name: "TRT",
    subjectIds: ["subject-1"],
    wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
  });
  data.subjects.push({
    id: "subject-1",
    contestId: "contest-1",
    name: "Legacy name",
    order: 1,
    isActive: true,
    plannedStudyMinutes: 60,
    itemIds: [],
    topicIds: []
  });
  data.runtimeState!.contestStorage["contest-1"] = "vault-markdown";
  return data;
}

describe("MarkdownAwarePluginDataStore", () => {
  it("reads Markdown authority and writes UI edits back without dual-writing durable JSON", async () => {
    const adapter = new MemoryAdapter(storedData());
    const legacy = new PluginDataStore(adapter);
    const files = new MemoryFiles();
    const markdownData = storedData();
    markdownData.subjects[0] = { ...markdownData.subjects[0], name: "Agent edit" };
    new MarkdownContestBundleCodec()
      .encode(markdownData, "contest-1")
      .forEach((file) => files.files.set(file.path, file.content));
    const store = new MarkdownAwarePluginDataStore(
      legacy,
      new MarkdownContestIndex(files),
      new MarkdownContestWriter(files, () => new Date("2026-07-21T22:00:00Z"))
    );

    expect((await store.load()).subjects[0].name).toBe("Agent edit");

    await store.mutate((data) => {
      data.subjects[0] = { ...data.subjects[0], plannedStudyMinutes: 90 };
      data.activeContestId = null;
    });

    const reloaded = await store.load();
    expect(reloaded.subjects[0]).toMatchObject({ name: "Agent edit", plannedStudyMinutes: 90 });
    expect(reloaded.activeContestId).toBeNull();
    expect(adapter.data.subjects[0].name).toBe("Legacy name");
    expect(adapter.data.subjects[0].plannedStudyMinutes).toBe(60);
  });

  it("reports legacy JSON drift after Markdown activation without replacing Markdown", async () => {
    const original = storedData();
    const prepared = await new MigrationSafetyService().prepare(
      original,
      "contest-1",
      "Leif/.backups/original.json",
      "2026-07-21T20:00:00Z"
    );
    original.runtimeState!.migrationReceipts.push({
      ...prepared.receipt,
      status: "activated",
      activatedAt: "2026-07-21T20:01:00Z"
    });
    const adapter = new MemoryAdapter(original);
    adapter.data.subjects[0] = { ...adapter.data.subjects[0], name: "Downgrade edit" };
    const files = new MemoryFiles();
    new MarkdownContestBundleCodec()
      .encode(storedData(), "contest-1")
      .forEach((file) => files.files.set(file.path, file.content));
    const store = new MarkdownAwarePluginDataStore(
      new PluginDataStore(adapter),
      new MarkdownContestIndex(files),
      new MarkdownContestWriter(files)
    );

    expect((await store.load()).subjects[0].name).toBe("Legacy name");
    expect(store.markdownDiagnostics).toEqual([
      expect.objectContaining({ code: "legacy-source-drift" })
    ]);
  });
});
