import type { Subject } from "@/domain/entities/Subject";

/**
 * Service for managing study cycle navigation.
 * Handles circular navigation through subjects and study items.
 */
export class CycleService {
  /**
   * Generic circular navigation through a collection.
   * Returns the next item in the cycle, wrapping around to the start.
   *
   * @param items - The collection to navigate through
   * @param currentItem - The current item (optional)
   * @param idGetter - Function to extract ID from an item
   * @returns The next item in the cycle, or null if collection is empty
   */
  private getNextInCycle<T>(
    items: T[],
    currentItem: T | undefined,
    idGetter: (item: T) => string
  ): T | null {
    if (items.length === 0) {
      return null;
    }

    if (!currentItem) {
      return items[0];
    }

    const currentIndex = items.findIndex((item) => idGetter(item) === idGetter(currentItem));

    if (currentIndex === -1) {
      return items[0];
    }

    return items[(currentIndex + 1) % items.length];
  }

  /**
   * Gets the next active subject in the study cycle.
   *
   * @param subjects - All subjects
   * @param currentSubjectId - ID of the current subject (optional)
   * @returns The next active subject, or null if no active subjects exist
   */
  getNextActiveSubject(subjects: Subject[], currentSubjectId?: string): Subject | null {
    const activeSubjects = subjects
      .filter((subject) => subject.isActive)
      .sort((left, right) => left.order - right.order);

    const currentSubject = currentSubjectId
      ? activeSubjects.find((s) => s.id === currentSubjectId)
      : undefined;

    return this.getNextInCycle(activeSubjects, currentSubject, (s) => s.id);
  }

  /**
   * Gets the next study item ID for a subject.
   *
   * @param subject - The subject containing items
   * @param currentItemId - ID of the current item (optional)
   * @param isCompleted - Optional predicate that returns true when an item is
   *   considered completed. When provided, the method skips completed items
   *   and returns null if every item is completed.
   * @returns The next item ID, or null if no items exist or all are completed
   */
  getNextItemId(
    subject: Subject,
    currentItemId?: string,
    isCompleted?: (itemId: string) => boolean
  ): string | null {
    if (subject.itemIds.length === 0) {
      return null;
    }

    if (!isCompleted) {
      if (!currentItemId) {
        return subject.itemIds[0];
      }

      const currentIndex = subject.itemIds.findIndex((itemId) => itemId === currentItemId);

      if (currentIndex === -1) {
        return subject.itemIds[0];
      }

      return subject.itemIds[(currentIndex + 1) % subject.itemIds.length];
    }

    const findNext = (): string | null => {
      for (const candidate of subject.itemIds) {
        if (!isCompleted(candidate)) {
          return candidate;
        }
      }
      return null;
    };

    if (!currentItemId) {
      return findNext();
    }

    const currentIndex = subject.itemIds.findIndex((itemId) => itemId === currentItemId);

    if (currentIndex === -1) {
      return findNext();
    }

    const total = subject.itemIds.length;
    for (let offset = 1; offset <= total; offset += 1) {
      const nextId = subject.itemIds[(currentIndex + offset) % total];
      if (!isCompleted(nextId)) {
        return nextId;
      }
    }

    return null;
  }
}
