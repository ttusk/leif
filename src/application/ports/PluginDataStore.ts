import type { LeifPluginData } from "@/domain/types/LeifPluginData";

type Mutable<T> = {
  -readonly [P in keyof T]: T[P] extends object ? Mutable<T[P]> : T[P];
};

export type MutableLeifPluginData = Mutable<LeifPluginData>;

export interface PluginDataDiagnostic {
  path: string;
  code: string;
  message: string;
}

/**
 * Persistence boundary for Leif data. `mutate` is the only write path: it
 * runs the mutation against a draft and persists it atomically, discarding
 * the draft when the mutation throws.
 */
export interface PluginDataStore {
  load(): Promise<LeifPluginData>;
  save(data: LeifPluginData): Promise<void>;
  mutate<T>(mutation: (draft: MutableLeifPluginData) => T | Promise<T>): Promise<T>;
  diagnostics?(): readonly PluginDataDiagnostic[];
  /**
   * Concursos whose study content is read-only (for example after a failed
   * migration). Their projections remain readable, but mutations touching
   * them are rejected by the store.
   */
  readOnlyContestIds?(): readonly string[];
}
