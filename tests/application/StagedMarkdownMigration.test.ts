import { describe, expect, it } from "vitest";

import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import { StagedMarkdownMigrationService } from "@/application/services/StagedMarkdownMigrationService";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";

class MemoryDataAdapter implements PersistentStorageAdapter<LeifPluginData> {
  constructor(private data: LeifPluginData) {}
  async load(): Promise<LeifPluginData> {
    return structuredClone(this.data);
  }
  async save(data: LeifPluginData): Promise<void> {
    this.data = structuredClone(data);
  }
}

class MemoryFileStore implements MarkdownFileStore {
  readonly files = new Map<string, string>();
  corruptStagedSubject = false;

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || [...this.files].some(([file]) => file.startsWith(`${path}/`));
  }
  async writeNew(path: string, content: string): Promise<void> {
    if (this.files.has(path)) throw new Error(`exists: ${path}`);
    if (this.corruptStagedSubject && path.includes("/.staging/") && path.includes("/materias/")) {
      content = content.replace('name: "Português"', 'name: "Divergente"');
    }
    this.files.set(path, content);
  }
  async read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`missing: ${path}`);
    return content;
  }
  async list(prefix: string): Promise<string[]> {
    return [...this.files.keys()].filter((path) => path.startsWith(`${prefix}/`));
  }
  async move(source: string, destination: string): Promise<void> {
    if (await this.exists(destination)) throw new Error(`exists: ${destination}`);
    const entries = [...this.files].filter(
      ([path]) => path === source || path.startsWith(`${source}/`)
    );
    entries.forEach(([path, content]) => {
      this.files.delete(path);
      this.files.set(`${destination}${path.slice(source.length)}`, content);
    });
  }
}

function legacyData(): LeifPluginData {
  return {
    ...createDefaultLeifPluginData(),
    activeContestId: "contest-1",
    contests: [
      {
        id: "contest-1",
        name: "TRT",
        subjectIds: ["subject-1"],
        wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
      }
    ],
    contestStates: [
      { contestId: "contest-1", currentSubjectId: "subject-1", currentItemId: "item-1" }
    ],
    subjects: [
      {
        id: "subject-1",
        contestId: "contest-1",
        name: "Português",
        order: 1,
        isActive: true,
        plannedStudyMinutes: 60,
        itemIds: ["item-1"],
        topicIds: []
      }
    ],
    studyItems: [{ id: "item-1", subjectId: "subject-1", title: "Sintaxe", order: 1 }]
  };
}

describe("StagedMarkdownMigrationService", () => {
  it("activates Markdown only after backup and staged read-back verification", async () => {
    const dataStore = new PluginDataStore(new MemoryDataAdapter(legacyData()));
    const files = new MemoryFileStore();
    const service = new StagedMarkdownMigrationService(
      dataStore,
      files,
      () => new Date("2026-07-21T20:00:00.000Z")
    );

    const receipt = await service.migrate("contest-1");

    expect(receipt.status).toBe("activated");
    expect(files.files.has(receipt.backupPath)).toBe(true);
    expect([...files.files.keys()].some((path) => path.endsWith("/concurso.md"))).toBe(true);
    expect([...files.files.keys()].some((path) => path.includes("/.staging/"))).toBe(false);
    const saved = await dataStore.load();
    expect(saved.runtimeState?.contestStorage["contest-1"]).toBe("vault-markdown");
    expect(saved.contests).toEqual(legacyData().contests);
  });

  it("keeps legacy JSON authoritative when staged Markdown is not equivalent", async () => {
    const dataStore = new PluginDataStore(new MemoryDataAdapter(legacyData()));
    const files = new MemoryFileStore();
    files.corruptStagedSubject = true;
    const service = new StagedMarkdownMigrationService(
      dataStore,
      files,
      () => new Date("2026-07-21T20:00:00.000Z")
    );

    await expect(service.migrate("contest-1")).rejects.toThrow(/not equivalent/i);

    const saved = await dataStore.load();
    expect(saved.runtimeState?.contestStorage["contest-1"] ?? "legacy-json").toBe("legacy-json");
    expect(saved.contests).toEqual(legacyData().contests);
    expect([...files.files.keys()].some((path) => path.includes("/.backups/"))).toBe(true);
  });
});
