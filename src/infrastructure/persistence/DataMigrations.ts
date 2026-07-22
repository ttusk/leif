import type { LeifPluginData } from "@/domain/types/LeifPluginData";

/**
 * Renumbers ordered children within each parent while preserving their
 * effective order. Array position is used as the stable tie-breaker.
 */
function normalizeOrdersByParent<T extends { order: number }>(
  items: T[],
  getParentKey: (item: T) => string
): T[] {
  const groups = new Map<string, Array<{ item: T; sourceIndex: number }>>();

  items.forEach((item, sourceIndex) => {
    const parentKey = getParentKey(item);
    const group = groups.get(parentKey) ?? [];
    group.push({ item, sourceIndex });
    groups.set(parentKey, group);
  });

  const normalizedOrders = new Map<T, number>();
  groups.forEach((group) => {
    group
      .sort(
        (left, right) => left.item.order - right.item.order || left.sourceIndex - right.sourceIndex
      )
      .forEach(({ item }, index) => normalizedOrders.set(item, index + 1));
  });

  return items.map((item) => ({ ...item, order: normalizedOrders.get(item) ?? 1 }));
}

function normalizeOrderedData(data: LeifPluginData): LeifPluginData {
  return {
    ...data,
    subjects: normalizeOrdersByParent(data.subjects, (subject) => subject.contestId),
    studyItems: normalizeOrdersByParent(data.studyItems, (item) => item.subjectId)
  };
}

export class UnsupportedSchemaVersionError extends Error {
  constructor(
    public readonly foundVersion: number,
    public readonly supportedVersion: number
  ) {
    super(
      `This data was created by a newer Leif version (schema ${foundVersion}); ` +
        `this version supports schema ${supportedVersion}. Open it read-only or update Leif.`
    );
    this.name = "UnsupportedSchemaVersionError";
  }
}

/**
 * Service for migrating plugin data between schema versions.
 * Handles backward compatibility when the data structure changes.
 */
export class DataMigrationService {
  private readonly CURRENT_VERSION = 1;

  /**
   * Migrates data from any previous version to the current version.
   *
   * @param data - The data to migrate (may be from any version)
   * @returns Migrated data at the current schema version
   */
  migrate(data: LeifPluginData): LeifPluginData {
    const version = data.schemaVersion ?? 1;
    let current: LeifPluginData = data;

    if (version > this.CURRENT_VERSION) {
      throw new UnsupportedSchemaVersionError(version, this.CURRENT_VERSION);
    }

    // Apply migrations sequentially
    if (version < 2) {
      current = this.migrateV1toV2(current);
    }
    if (version < 3) {
      current = this.migrateV2toV3(current);
    }

    // Ordering is a presentation invariant. Identity conflicts are deliberately
    // preserved so a repair flow can resolve them without silently losing data.
    current = normalizeOrderedData(current);

    // Always include the current version
    return {
      ...current,
      schemaVersion: this.CURRENT_VERSION
    };
  }

  /**
   * Migration from version 1 to version 2.
   * Add future migrations here when schema changes.
   */
  private migrateV1toV2(data: LeifPluginData): LeifPluginData {
    // Example: If we added a new field, we'd initialize it here
    // return { ...data, newField: defaultValue };
    return data;
  }

  /**
   * Migration from version 2 to version 3.
   * Placeholder for future migrations.
   */
  private migrateV2toV3(data: LeifPluginData): LeifPluginData {
    return data;
  }

  /**
   * Gets the current schema version.
   */
  getCurrentVersion(): number {
    return this.CURRENT_VERSION;
  }
}
