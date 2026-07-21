import type { LeifPluginData } from "@/domain/types/LeifPluginData";

/**
 * Removes duplicate entries from an array based on a key extractor.
 * Keeps the first occurrence of each key.
 */
function deduplicateByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

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

/**
 * Deduplicates all entity arrays in the plugin data.
 * Also deduplicates subjectIds within each contest.
 */
function deduplicatePluginData(data: LeifPluginData): LeifPluginData {
  const subjects = deduplicateByKey(data.subjects, (subject) => subject.id);
  const studyItems = deduplicateByKey(data.studyItems, (item) => item.id);

  return {
    ...data,
    contests: data.contests.map((contest) => ({
      ...contest,
      subjectIds: [...new Set(contest.subjectIds)]
    })),
    subjects: normalizeOrdersByParent(subjects, (subject) => subject.contestId),
    topics: deduplicateByKey(data.topics, (t) => t.id),
    studyItems: normalizeOrdersByParent(studyItems, (item) => item.subjectId),
    studySessions: deduplicateByKey(data.studySessions, (s) => s.id),
    contestStates: deduplicateByKey(data.contestStates, (s) => s.contestId)
  };
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

    // Apply migrations sequentially
    if (version < 2) {
      current = this.migrateV1toV2(current);
    }
    if (version < 3) {
      current = this.migrateV2toV3(current);
    }

    // Always deduplicate entities to prevent corruption
    current = deduplicatePluginData(current);

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
