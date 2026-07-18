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

  constructor(private readonly storageAdapter: PersistentStorageAdapter<LeifPluginData>) {
    this.migrationService = new DataMigrationService();
  }

  /**
   * Loads plugin data from storage, applying migrations if necessary.
   *
   * @returns The loaded and migrated plugin data
   */
  async load(): Promise<LeifPluginData> {
    const storedData = await this.storageAdapter.load();

    if (!storedData) {
      return createDefaultLeifPluginData();
    }

    // Migrate data to current schema version
    const migratedData = this.migrationService.migrate(storedData);

    // Merge with defaults to ensure all required fields exist
    return {
      ...createDefaultLeifPluginData(),
      ...migratedData
    };
  }

  /**
   * Saves plugin data to storage.
   *
   * @param data - The data to save
   */
  async save(data: LeifPluginData): Promise<void> {
    await this.storageAdapter.save(data);
  }
}
