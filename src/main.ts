import { Plugin } from "obsidian";

import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { ObsidianStorageAdapter } from "@/infrastructure/obsidian/ObsidianStorageAdapter";
import { registerLeifView } from "@/ui/view/registerLeifView";

export default class LeifPlugin extends Plugin {
  private dataStore!: PluginDataStore;

  override async onload(): Promise<void> {
    this.dataStore = new PluginDataStore(new ObsidianStorageAdapter(this));
    await this.dataStore.load();

    registerLeifView(this, this.dataStore);
  }
}
