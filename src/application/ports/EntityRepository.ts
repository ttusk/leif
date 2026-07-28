import type { EntityCollectionKey, EntityCollections } from "@/domain/types/LeifPluginData";

/**
 * Generic repository port for entity collections.
 * Provides CRUD operations for any entity type.
 */
export interface EntityRepositoryPort<T> {
  findById(id: string): Promise<T>;
  findAll(): Promise<T[]>;
  exists(id: string): Promise<boolean>;
  create(entity: T): Promise<T>;
  update(id: string, updater: (entity: T) => T): Promise<T>;
  delete(id: string): Promise<void>;
  replaceAll(entities: T[]): Promise<void>;
}

export interface RepositoryFactory {
  for<K extends EntityCollectionKey>(key: K): EntityRepositoryPort<EntityCollections[K]>;
}
