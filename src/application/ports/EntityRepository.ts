import type { LeifPluginData } from "@/domain/types/LeifPluginData";

/**
 * Port for a generic entity repository managing a collection of entities
 * keyed by an `id` field. Application layer depends on this abstraction so
 * it stays decoupled from any concrete persistence mechanism.
 *
 * @template T - The entity type (must have an id field)
 */
export interface EntityRepositoryPort<T extends { id: string }> {
  findById(id: string): Promise<T>;
  findAll(): Promise<T[]>;
  exists(id: string): Promise<boolean>;
  create(entity: T): Promise<T>;
  update(id: string, updater: (entity: T) => T): Promise<T>;
  delete(id: string): Promise<void>;
  replaceAll(entities: T[]): Promise<void>;
}

/**
 * Port for a factory that produces {@link EntityRepositoryPort} instances
 * scoped to a given collection of {@link LeifPluginData}. Use cases receive
 * this port instead of constructing a concrete repository themselves.
 */
export interface RepositoryFactory {
  for<T extends { id: string }>(key: keyof LeifPluginData): EntityRepositoryPort<T>;
}
