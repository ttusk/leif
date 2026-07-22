import type { PluginDataStore as PluginDataStorePort } from "@/application/ports/PluginDataStore";
import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { DataMigrationService } from "@/infrastructure/persistence/DataMigrations";

/**
 * Implementation of the plugin data store.
 * Handles loading, saving, and migrating plugin data.
 */
export class PluginDataStore implements PluginDataStorePort {
  private readonly migrationService: DataMigrationService;
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(private readonly storageAdapter: PersistentStorageAdapter<LeifPluginData>) {
    this.migrationService = new DataMigrationService();
  }

  /**
   * Loads plugin data from storage, applying migrations if necessary.
   *
   * @returns The loaded and migrated plugin data
   */
  async load(): Promise<LeifPluginData> {
    await this.transactionTail;
    return this.loadCurrentData();
  }

  private async loadCurrentData(): Promise<LeifPluginData> {
    const storedData = await this.storageAdapter.load();

    if (!storedData) {
      return createDefaultLeifPluginData();
    }

    // Migrate data to current schema version
    const migratedData = this.migrationService.migrate(storedData);

    // Merge with defaults to ensure all required fields exist
    const defaults = createDefaultLeifPluginData();
    return {
      ...defaults,
      ...migratedData,
      runtimeState: {
        ...defaults.runtimeState!,
        ...migratedData.runtimeState
      }
    };
  }

  /**
   * Saves plugin data to storage.
   *
   * @param data - The data to save
   */
  async save(data: LeifPluginData): Promise<void> {
    await this.runExclusive(async () => {
      await this.storageAdapter.save(structuredClone(data));
    });
  }

  /**
   * Applies a mutation to an isolated draft and persists it once. Mutations are
   * serialized so concurrent UI actions cannot overwrite one another. A thrown
   * error discards the draft and leaves the persisted snapshot unchanged.
   */
  async mutate<T>(mutation: (draft: LeifPluginData) => T | Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      const draft = structuredClone(await this.loadCurrentData());
      const result = await mutation(draft);
      await this.storageAdapter.save(draft);
      return result;
    });
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.transactionTail.then(operation, operation);
    this.transactionTail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}
