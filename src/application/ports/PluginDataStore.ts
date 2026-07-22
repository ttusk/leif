import type { LeifPluginData } from "@/domain/types/LeifPluginData";

type Mutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer TItem)[]
    ? Mutable<TItem>[]
    : T extends object
      ? { -readonly [TKey in keyof T]: Mutable<T[TKey]> }
      : T;

export type MutableLeifPluginData = Mutable<LeifPluginData>;

export interface PluginDataDiagnostic {
  path: string;
  code: string;
  message: string;
}

export interface PluginDataStore {
  load(): Promise<LeifPluginData>;
  save(data: LeifPluginData): Promise<void>;
  mutate<T>(mutation: (draft: MutableLeifPluginData) => T | Promise<T>): Promise<T>;
  diagnostics?(): readonly PluginDataDiagnostic[];
}
