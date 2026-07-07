import type { Contest } from "@/domain/entities/Contest";
import type { ContestState } from "@/domain/entities/ContestState";
import type { StudyItem } from "@/domain/entities/StudyItem";
import type { StudySession } from "@/domain/entities/StudySession";
import type { Subject } from "@/domain/entities/Subject";
import type { Topic } from "@/domain/entities/Topic";

// ContestState is intentionally not in EntityCollections (no `id` field,
// accessed directly from LeifPluginData). Import stays for the data shape.

/**
 * Maps each persisted entity collection key to the entity it stores.
 * Used to type the {@link EntityRepository} accessor so call sites
 * don't need `as unknown as T[]` casts. Only entities accessed via
 * the repository port belong here; `contestStates` is read directly
 * (no `id` field) and therefore excluded.
 */
export interface EntityCollections {
  contests: Contest;
  subjects: Subject;
  topics: Topic;
  studyItems: StudyItem;
  studySessions: StudySession;
}

export type EntityCollectionKey = keyof EntityCollections;

export interface LeifPluginData {
  schemaVersion?: number;
  activeContestId: string | null;
  contests: Contest[];
  contestStates: ContestState[];
  subjects: Subject[];
  topics: Topic[];
  studyItems: StudyItem[];
  studySessions: StudySession[];
}

export function createDefaultLeifPluginData(): LeifPluginData {
  return {
    schemaVersion: 1,
    activeContestId: null,
    contests: [],
    contestStates: [],
    subjects: [],
    topics: [],
    studyItems: [],
    studySessions: []
  };
}
