import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";

export class InMemoryStorageAdapter implements PersistentStorageAdapter<LeifPluginData> {
  private data: LeifPluginData | null;

  constructor(initialData: LeifPluginData | null = createDefaultLeifPluginData()) {
    this.data = initialData ? structuredClone(initialData) : null;
  }

  async load(): Promise<LeifPluginData | null> {
    return this.data ? structuredClone(this.data) : null;
  }

  async save(data: LeifPluginData): Promise<void> {
    this.data = structuredClone(data);
  }
}

export function createTestStore(initialData = createDefaultLeifPluginData()): {
  store: PluginDataStore;
  factory: EntityRepositoryFactory;
  adapter: InMemoryStorageAdapter;
} {
  const adapter = new InMemoryStorageAdapter(initialData);
  const store = new PluginDataStore(adapter);
  return {
    store,
    factory: new EntityRepositoryFactory(store),
    adapter
  };
}
