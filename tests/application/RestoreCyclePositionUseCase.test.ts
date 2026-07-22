import { describe, expect, it } from "vitest";

import type { PluginDataStore as PluginDataStorePort } from "@/application/ports/PluginDataStore";
import { RestoreCyclePositionUseCase } from "@/application/use-cases/RestoreCyclePositionUseCase";
import { ValidationError } from "@/domain/errors/DomainErrors";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";

class InMemoryStore implements PluginDataStorePort {
  saveCount = 0;

  constructor(private data: LeifPluginData) {}

  async load(): Promise<LeifPluginData> {
    return this.data;
  }

  async save(data: LeifPluginData): Promise<void> {
    this.saveCount += 1;
    this.data = data;
  }

  async mutate<T>(mutation: Parameters<PluginDataStorePort["mutate"]>[0]): Promise<T> {
    const draft = structuredClone(this.data);
    const result = await mutation(draft);
    this.data = draft;
    this.saveCount += 1;
    return result as T;
  }
}

function createStore(): InMemoryStore {
  const data = createDefaultLeifPluginData();
  data.activeContestId = "contest-1";
  data.contestStates = [
    { contestId: "contest-1", currentSubjectId: "subject-2", currentItemId: "item-2" }
  ];
  return new InMemoryStore(data);
}

describe("RestoreCyclePositionUseCase", () => {
  it("restores the previous position only when the cycle is still at the expected position", async () => {
    const store = createStore();
    const useCase = new RestoreCyclePositionUseCase(store);

    await useCase.execute({
      contestId: "contest-1",
      expectedPosition: { subjectId: "subject-2", itemId: "item-2" },
      restorePosition: { subjectId: "subject-1", itemId: "item-1" }
    });

    expect((await store.load()).contestStates[0]).toEqual({
      contestId: "contest-1",
      currentSubjectId: "subject-1",
      currentItemId: "item-1"
    });
    expect(store.saveCount).toBe(1);
  });

  it("rejects stale undo without overwriting a newer cycle position", async () => {
    const store = createStore();
    const useCase = new RestoreCyclePositionUseCase(store);

    await expect(
      useCase.execute({
        contestId: "contest-1",
        expectedPosition: { subjectId: "subject-3", itemId: null },
        restorePosition: { subjectId: "subject-1", itemId: "item-1" }
      })
    ).rejects.toBeInstanceOf(ValidationError);

    expect((await store.load()).contestStates[0]?.currentSubjectId).toBe("subject-2");
    expect(store.saveCount).toBe(0);
  });
});
