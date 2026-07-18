import { NoActiveContestError } from "@/domain/errors/DomainErrors";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { Subject } from "@/domain/entities/Subject";

/**
 * Guard for ensuring an active contest exists and providing related queries.
 */
export class ActiveContestGuard {
  constructor(private readonly dataStore: PluginDataStore) {}

  /**
   * Requires that an active contest exists.
   *
   * @returns The active contest ID
   * @throws {NoActiveContestError} If no active contest exists
   */
  async requireActiveContest(): Promise<string> {
    const data = await this.dataStore.load();
    if (!data.activeContestId) {
      throw new NoActiveContestError();
    }
    return data.activeContestId;
  }

  /**
   * Gets all subjects for the active contest, sorted by order.
   *
   * @returns Array of subjects for the active contest
   * @throws {NoActiveContestError} If no active contest exists
   */
  async getActiveContestSubjects(): Promise<Subject[]> {
    const data = await this.dataStore.load();
    const activeContestId = await this.requireActiveContest();
    return data.subjects
      .filter((s) => s.contestId === activeContestId)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Gets only active subjects for the active contest, sorted by order.
   *
   * @returns Array of active subjects for the active contest
   * @throws {NoActiveContestError} If no active contest exists
   */
  async getActiveSubjects(): Promise<Subject[]> {
    const subjects = await this.getActiveContestSubjects();
    return subjects.filter((s) => s.isActive);
  }
}
