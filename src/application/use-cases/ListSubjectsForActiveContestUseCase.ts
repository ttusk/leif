import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { Subject } from "@/domain/entities/Subject";
import { ActiveContestGuard } from "@/application/guards/ActiveContestGuard";

/**
 * Use case for listing subjects of the active contest.
 */
export class ListSubjectsForActiveContestUseCase {
  private readonly guard: ActiveContestGuard;

  constructor(private readonly dataStore: PluginDataStore) {
    this.guard = new ActiveContestGuard(dataStore);
  }

  async execute(): Promise<Subject[]> {
    return await this.guard.getActiveContestSubjects();
  }
}
