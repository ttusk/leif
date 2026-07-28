import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
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

function fixture(name: string): LeifPluginData {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `tests/fixtures/v1/${name}.json`), "utf8")
  ) as LeifPluginData;
}

describe("v1 upgrade compatibility", () => {
  it("fills missing historical collections and projects relation arrays", async () => {
    const store = new PluginDataStore(new MemoryAdapter(fixture("partial")));

    const loaded = await store.load();

    expect(loaded.activeContestId).toBe("contest-1");
    expect(loaded.contests).toHaveLength(1);
    expect(loaded.subjects[0]).toMatchObject({
      id: "subject-1",
      name: "Língua Portuguesa",
      order: 1,
      resourceIds: [],
      topicIds: []
    });
    expect(loaded.cycleStates).toEqual([]);
    expect(loaded.topics).toEqual([]);
    expect(loaded.resources).toEqual([]);
    expect(loaded.studyRecords).toEqual([]);
  });

  it("normalizes duplicate zero-based orders independently and keeps all concursos", async () => {
    const adapter = new MemoryAdapter(fixture("multi-contest"));
    const store = new PluginDataStore(adapter);

    const loaded = await store.load();
    expect(loaded.subjects.map(({ id, order }) => [id, order])).toEqual([
      ["subject-a1", 1],
      ["subject-a2", 2],
      ["subject-b1", 1]
    ]);
    expect(loaded.resources.map(({ id, order }) => [id, order])).toEqual([
      ["item-b1", 1],
      ["item-b2", 2]
    ]);

    await store.mutate((data) => {
      data.runtimeState!.lastAcknowledgedVersion = "3.0.0";
    });
    const reloaded = await store.load();
    expect(reloaded.contests.map(({ id }) => id)).toEqual(["contest-a", "contest-b"]);
    expect(reloaded.subjects).toEqual(loaded.subjects);
    expect(reloaded.resources).toEqual(loaded.resources);
  });

  it("preserves duplicate legacy ids for later repair while projecting orphan resources", async () => {
    const loaded = await new PluginDataStore(
      new MemoryAdapter(fixture("malformed-relations"))
    ).load();

    expect(loaded.subjects).toHaveLength(2);
    expect(loaded.resources).toHaveLength(1);
    expect(loaded.resources[0]).toMatchObject({ id: "orphan-item", subjectId: "missing" });
  });

  it("loads and persists a large v1 study history without losing records", async () => {
    const large = createDefaultLeifPluginData() as unknown as LeifPluginData & {
      studyItems: unknown[];
      studySessions: unknown[];
    };
    delete large.runtimeState;
    large.schemaVersion = 1;
    large.studySessions = [];
    large.contests.push({
      id: "contest-large",
      name: "Concurso grande",
      subjectIds: []
    } as never);
    for (let subjectIndex = 0; subjectIndex < 40; subjectIndex += 1) {
      const subjectId = `subject-${subjectIndex}`;
      large.contests[0].subjectIds.push(subjectId);
      large.subjects.push({
        id: subjectId,
        contestId: "contest-large",
        name: `Matéria ${subjectIndex}`,
        order: subjectIndex,
        isActive: true,
        plannedStudyMinutes: 45,
        resourceIds: [],
        topicIds: []
      });
      for (let sessionIndex = 0; sessionIndex < 50; sessionIndex += 1) {
        large.studySessions.push({
          id: `session-${subjectIndex}-${sessionIndex}`,
          contestId: "contest-large",
          subjectId,
          type: "pdf",
          studiedAt: "2026-01-01T12:00:00.000Z",
          pagesOrCount: sessionIndex + 1
        } as never);
      }
    }
    const adapter = new MemoryAdapter(large);
    const store = new PluginDataStore(adapter);

    expect((await store.load()).studyRecords).toHaveLength(2_000);
    await store.mutate((data) => {
      data.activeContestId = "contest-large";
    });
    expect((await store.load()).studyRecords).toHaveLength(2_000);
  });
});
