import { NotFoundError, AlreadyExistsError } from "@/domain/errors/DomainErrors";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { EntityRepositoryPort } from "@/application/ports/EntityRepository";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";

/**
 * Concrete {@link EntityRepositoryPort} backed by the plugin data store.
 * Lives in the infrastructure layer so the application layer never imports it.
 *
 * @template T - The entity type (must have an id field)
 */
export class EntityRepository<T extends { id: string }> implements EntityRepositoryPort<T> {
  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly entityKey: keyof LeifPluginData
  ) {}

  /**
   * Finds an entity by ID.
   * 
   * @param id - The entity ID
   * @returns The found entity
   * @throws {NotFoundError} If the entity is not found
   */
  async findById(id: string): Promise<T> {
    const data = await this.dataStore.load();
    const entities = data[this.entityKey] as unknown as T[];
    const entity = entities.find(e => e.id === id);
    
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
  async findAll(): Promise<T[]> {
    const data = await this.dataStore.load();
    return data[this.entityKey] as unknown as T[];
  }

  /**
   * Checks if an entity exists by ID.
   * 
   * @param id - The entity ID
   * @returns True if the entity exists, false otherwise
   */
  async exists(id: string): Promise<boolean> {
    const data = await this.dataStore.load();
    const entities = data[this.entityKey] as unknown as T[];
    return entities.some(e => e.id === id);
  }

  /**
   * Creates a new entity.
   * 
   * @param entity - The entity to create
   * @returns The created entity
   * @throws {AlreadyExistsError} If an entity with the same ID already exists
   */
  async create(entity: T): Promise<T> {
    const data = await this.dataStore.load();
    const entities = data[this.entityKey] as unknown as T[];
    
    if (entities.some(e => e.id === entity.id)) {
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
  async update(id: string, updater: (entity: T) => T): Promise<T> {
    const data = await this.dataStore.load();
    const entities = data[this.entityKey] as unknown as T[];
    const index = entities.findIndex(e => e.id === id);
    
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
    const entities = data[this.entityKey] as unknown as T[];
    const index = entities.findIndex(e => e.id === id);
    
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
  async replaceAll(entities: T[]): Promise<void> {
    const data = await this.dataStore.load();
    (data[this.entityKey] as unknown as T[]) = entities;
    await this.dataStore.save(data);
  }
}
