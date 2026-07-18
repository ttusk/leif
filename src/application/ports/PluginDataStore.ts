import type { LeifPluginData } from "@/domain/types/LeifPluginData";

export interface PluginDataStore {
  load(): Promise<LeifPluginData>;
  save(data: LeifPluginData): Promise<void>;
}
