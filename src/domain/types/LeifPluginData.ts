import type { Contest } from "@/domain/entities/Contest";
import type { CycleState } from "@/domain/entities/CycleState";
import type { Resource } from "@/domain/entities/Resource";
import type { StudySession } from "@/domain/entities/StudySession";
import type { Subject } from "@/domain/entities/Subject";
import type { Topic } from "@/domain/entities/Topic";
import { createDefaultLeifRuntimeState, type LeifRuntimeState } from "./LeifRuntimeState";

/**
 * In-memory shape of every study collection plus the operational state kept
 * in plugin JSON. Markdown is the authority for study content; JSON keeps
 * only operational state (see runtimeState).
 */
export interface LeifPluginData {
  schemaVersion?: number;
  activeContestId: string | null;
  contests: Contest[];
  cycleStates: CycleState[];
  subjects: Subject[];
  topics: Topic[];
  resources: Resource[];
  studySessions: StudySession[];
  runtimeState?: LeifRuntimeState;
}

export interface EntityCollections {
  contests: Contest;
  subjects: Subject;
  topics: Topic;
  resources: Resource;
  studySessions: StudySession;
}

export type EntityCollectionKey = keyof EntityCollections;

export const LEIF_DATA_SCHEMA_VERSION = 3;

export function createDefaultLeifPluginData(): LeifPluginData {
  return {
    schemaVersion: LEIF_DATA_SCHEMA_VERSION,
    activeContestId: null,
    contests: [],
    cycleStates: [],
    subjects: [],
    topics: [],
    resources: [],
    studySessions: [],
    runtimeState: createDefaultLeifRuntimeState()
  };
}
