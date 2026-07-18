import { NotFoundError, AlreadyExistsError } from "@/domain/errors/DomainErrors";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort } from "@/application/ports/EntityRepository";
import type {
  EntityCollections,
  EntityCollectionKey,
  LeifPluginData
} from "@/domain/types/LeifPluginData";

/**
 * Concrete {@link EntityRepositoryPort} backed by the plugin data store.
 * Lives in the infrastructure layer so the application layer never imports it.
 *
 * @template K - The collection key in {@link LeifPluginData}
 */
export class EntityRepository<K extends EntityCollectionKey> implements EntityRepositoryPort<
  EntityCollections[K]
> {
  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly entityKey: K
  ) {}

  /**
   * Finds an entity by ID.
   *
   * @param id - The entity ID
   * @returns The found entity
   * @throws {NotFoundError} If the entity is not found
   */
  async findById(id: string): Promise<EntityCollections[K]> {
    const data = await this.dataStore.load();
    const entities = this.collection(data);
    const entity = entities.find((e) => e.id === id);

    if (!entity) {
      throw new NotFoundError(String(this.entityKey), id);
    }

    return entity;
  }

  /**
   * Finds all entities.
   *
   * @returns Array of all entities
   */
  async findAll(): Promise<EntityCollections[K][]> {
    const data = await this.dataStore.load();
    return this.collection(data);
  }

  /**
   * Checks if an entity exists by ID.
   *
   * @param id - The entity ID
   * @returns True if the entity exists, false otherwise
   */
  async exists(id: string): Promise<boolean> {
    const data = await this.dataStore.load();
    const entities = this.collection(data);
    return entities.some((e) => e.id === id);
  }

  /**
   * Creates a new entity.
   *
   * @param entity - The entity to create
   * @returns The created entity
   * @throws {AlreadyExistsError} If an entity with the same ID already exists
   */
  async create(entity: EntityCollections[K]): Promise<EntityCollections[K]> {
    const data = await this.dataStore.load();
    const entities = this.collection(data);

    if (entities.some((e) => e.id === entity.id)) {
      throw new AlreadyExistsError(String(this.entityKey), entity.id);
    }

    entities.push(entity);
    await this.dataStore.save(data);
    return entity;
  }

  /**
   * Updates an existing entity using an updater function.
   *
   * @param id - The entity ID
   * @param updater - Function that takes the entity and returns the updated version
   * @returns The updated entity
   * @throws {NotFoundError} If the entity is not found
   */
  async update(
    id: string,
    updater: (entity: EntityCollections[K]) => EntityCollections[K]
  ): Promise<EntityCollections[K]> {
    const data = await this.dataStore.load();
    const entities = this.collection(data);
    const index = entities.findIndex((e) => e.id === id);

    if (index === -1) {
      throw new NotFoundError(String(this.entityKey), id);
    }

    const updated = updater(entities[index]);
    entities[index] = updated;
    await this.dataStore.save(data);
    return updated;
  }

  /**
   * Deletes an entity by ID.
   *
   * @param id - The entity ID
   * @throws {NotFoundError} If the entity is not found
   */
  async delete(id: string): Promise<void> {
    const data = await this.dataStore.load();
    const entities = this.collection(data);
    const index = entities.findIndex((e) => e.id === id);

    if (index === -1) {
      throw new NotFoundError(String(this.entityKey), id);
    }

    entities.splice(index, 1);
    await this.dataStore.save(data);
  }

  /**
   * Replaces all entities in the collection.
   *
   * @param entities - The new entities to store
   */
  async replaceAll(entities: EntityCollections[K][]): Promise<void> {
    const data = await this.dataStore.load();
    this.setCollection(data, entities);
    await this.dataStore.save(data);
  }

  /**
   * Typed accessor for this repository's collection. Centralizes the
   * single cast used to bridge {@link LeifPluginData}'s union-typed
   * arrays with the per-key {@link EntityCollections} mapping so methods
   * don't each repeat `as unknown as T[]`.
   */
  private collection(data: LeifPluginData): EntityCollections[K][] {
    return data[this.entityKey] as unknown as EntityCollections[K][];
  }

  private setCollection(data: LeifPluginData, entities: EntityCollections[K][]): void {
    (data[this.entityKey] as unknown as EntityCollections[K][]) = entities;
  }
}
