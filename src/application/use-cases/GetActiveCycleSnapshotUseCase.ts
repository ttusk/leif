import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { Resource } from "@/domain/entities/Resource";
import type { Subject } from "@/domain/entities/Subject";
import { NotFoundError } from "@/domain/errors/DomainErrors";
import { CycleService } from "@/domain/services/CycleService";

export interface ActiveCycleSnapshot {
  contestId: string;
  currentSubject: Subject | null;
  nextSubject: Subject | null;
  currentResourceId: string | null;
  nextResourceId: string | null;
  currentResource?: Resource | null;
  nextResource?: Resource | null;
}

export class GetActiveCycleSnapshotUseCase {
  private readonly cycleService = new CycleService();

  constructor(private readonly dataStore: PluginDataStore) {}

  async execute(): Promise<ActiveCycleSnapshot | null> {
    const data = await this.dataStore.load();
    const activeContestId = data.activeContestId;
    if (!activeContestId) {
      return null;
    }
    if (!data.contests.some((contest) => contest.id === activeContestId)) {
      throw new NotFoundError("contests", activeContestId);
    }
    const subjects = data.subjects.filter((subject) => subject.contestId === activeContestId);
    const subjectIds = new Set(subjects.map((subject) => subject.id));
    const resources = data.resources.filter((resource) => subjectIds.has(resource.subjectId));
    const records = data.studyRecords.filter((record) => record.contestId === activeContestId);
    const state = data.cycleStates.find((entry) => entry.contestId === activeContestId);
    const current = this.cycleService.getRecommendation(subjects, resources, records, state);
    const next = this.cycleService.advance(subjects, resources, records, {
      contestId: activeContestId,
      currentSubjectId: current.subjectId,
      currentResourceId: current.resourceId
    });
    const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
    return {
      contestId: activeContestId,
      currentSubject: subjects.find((subject) => subject.id === current.subjectId) ?? null,
      nextSubject: subjects.find((subject) => subject.id === next?.subjectId) ?? null,
      currentResourceId: current.resourceId,
      nextResourceId: next?.resourceId ?? null,
      currentResource: current.resourceId ? (resourceById.get(current.resourceId) ?? null) : null,
      nextResource: next?.resourceId ? (resourceById.get(next.resourceId) ?? null) : null
    };
  }
}
