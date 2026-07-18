import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { EntityRepository } from "@/infrastructure/persistence/EntityRepository";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { NotFoundError, AlreadyExistsError } from "@/domain/errors/DomainErrors";

class InMemoryStorageAdapter implements PersistentStorageAdapter<LeifPluginData> {
  private data: LeifPluginData | null;

  constructor(initialData: LeifPluginData | null = null) {
    this.data = initialData;
  }

  async load(): Promise<LeifPluginData | null> {
    return this.data;
  }

  async save(data: LeifPluginData): Promise<void> {
    this.data = data;
  }
}

function createStore(): PluginDataStore {
  return new PluginDataStore(new InMemoryStorageAdapter(createDefaultLeifPluginData()));
}

describe("EntityRepository", () => {
  it("finds an entity by id", async () => {
    const store = createStore();
    const repo = new EntityRepository(store, "contests");

    const contest = {
      id: "contest-1",
      name: "TRT",
      subjectIds: [],
      wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
    };
    await repo.create(contest);

    const found = await repo.findById("contest-1");
    expect(found).toEqual(contest);
  });

  it("throws NotFoundError when entity is not found", async () => {
    const store = createStore();
    const repo = new EntityRepository(store, "contests");

    await expect(repo.findById("nonexistent")).rejects.toThrow(NotFoundError);
  });

  it("creates an entity and prevents duplicates", async () => {
    const store = createStore();
    const repo = new EntityRepository(store, "contests");

    const contest = {
      id: "contest-1",
      name: "TRT",
      subjectIds: [],
      wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
    };
    await repo.create(contest);

    await expect(repo.create(contest)).rejects.toThrow(AlreadyExistsError);
  });

  it("finds all entities", async () => {
    const store = createStore();
    const repo = new EntityRepository(store, "contests");

    await repo.create({
      id: "contest-1",
      name: "TRT",
      subjectIds: [],
      wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
    });
    await repo.create({
      id: "contest-2",
      name: "SEFAZ",
      subjectIds: [],
      wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
    });

    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  it("checks if an entity exists", async () => {
    const store = createStore();
    const repo = new EntityRepository(store, "contests");

    await repo.create({
      id: "contest-1",
      name: "TRT",
      subjectIds: [],
      wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
    });

    expect(await repo.exists("contest-1")).toBe(true);
    expect(await repo.exists("nonexistent")).toBe(false);
  });

  it("updates an entity", async () => {
    const store = createStore();
    const repo = new EntityRepository(store, "contests");

    await repo.create({
      id: "contest-1",
      name: "TRT",
      subjectIds: [],
      wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
    });

    const updated = await repo.update("contest-1", (contest) => ({
      ...contest,
      name: "TRT Updated"
    }));
    expect(updated.name).toBe("TRT Updated");

    const found = await repo.findById("contest-1");
    expect(found.name).toBe("TRT Updated");
  });

  it("deletes an entity", async () => {
    const store = createStore();
    const repo = new EntityRepository(store, "contests");

    await repo.create({
      id: "contest-1",
      name: "TRT",
      subjectIds: [],
      wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
    });
    await repo.delete("contest-1");

    expect(await repo.exists("contest-1")).toBe(false);
  });

  it("replaces all entities", async () => {
    const store = createStore();
    const repo = new EntityRepository(store, "contests");

    await repo.create({
      id: "contest-1",
      name: "TRT",
      subjectIds: [],
      wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
    });
    await repo.replaceAll([
      {
        id: "contest-2",
        name: "SEFAZ",
        subjectIds: [],
        wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
      }
    ]);

    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("contest-2");
  });
});
