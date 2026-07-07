import type { EntityRepositoryPort, RepositoryFactory } from "@/application/ports/EntityRepository";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityCollections, EntityCollectionKey } from "@/domain/types/LeifPluginData";
import { EntityRepository } from "@/infrastructure/persistence/EntityRepository";

/**
 * Concrete {@link RepositoryFactory} that wires {@link EntityRepository}
 * instances to the plugin data store. Constructed once at the composition
 * root and injected into use cases.
 */
export class EntityRepositoryFactory implements RepositoryFactory {
  constructor(private readonly dataStore: PluginDataStore) {}

  for<K extends EntityCollectionKey>(key: K): EntityRepositoryPort<EntityCollections[K]> {
    return new EntityRepository<K>(this.dataStore, key);
  }
}
