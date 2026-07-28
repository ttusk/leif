import { describe, expect, it } from "vitest";

import { Contest } from "@/domain/entities/Contest";
import { AlreadyExistsError, NotFoundError } from "@/domain/errors/DomainErrors";
import { EntityRepository } from "@/infrastructure/persistence/EntityRepository";
import { createTestStore } from "../helpers/InMemoryStore";

describe("EntityRepository", () => {
  it("creates, finds, updates and deletes schema-3 entities", async () => {
    const { store } = createTestStore();
    const repo = new EntityRepository(store, "contests");
    const contest = new Contest("contest-1", "TRT");

    await repo.create(contest);

    await expect(repo.findById("contest-1")).resolves.toEqual(contest);
    await expect(repo.exists("contest-1")).resolves.toBe(true);
    await expect(repo.findAll()).resolves.toHaveLength(1);

    const updated = await repo.update("contest-1", (entry) => new Contest(entry.id, "TRT Updated"));
    expect(updated.name).toBe("TRT Updated");

    await repo.delete("contest-1");
    await expect(repo.exists("contest-1")).resolves.toBe(false);
  });

  it("prevents duplicate ids and reports missing entities", async () => {
    const { store } = createTestStore();
    const repo = new EntityRepository(store, "contests");
    const contest = new Contest("contest-1", "TRT");

    await repo.create(contest);

    await expect(repo.create(contest)).rejects.toThrow(AlreadyExistsError);
    await expect(repo.findById("missing")).rejects.toThrow(NotFoundError);
  });

  it("replaces all entities in a collection", async () => {
    const { store } = createTestStore();
    const repo = new EntityRepository(store, "contests");

    await repo.create(new Contest("contest-1", "TRT"));
    await repo.replaceAll([new Contest("contest-2", "SEFAZ")]);

    await expect(repo.findAll()).resolves.toMatchObject([{ id: "contest-2" }]);
  });
});
