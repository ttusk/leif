import type { Plugin } from "obsidian";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";

export class ObsidianStorageAdapter implements PersistentStorageAdapter<LeifPluginData> {
  constructor(private readonly plugin: Plugin) {}

  async load(): Promise<LeifPluginData | null> {
    return (await this.plugin.loadData()) as LeifPluginData | null;
  }

  async save(data: LeifPluginData): Promise<void> {
    await this.plugin.saveData(data);
  }
}
