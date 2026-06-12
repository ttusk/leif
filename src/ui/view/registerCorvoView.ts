import * as Obsidian from "obsidian";

import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CorvoView } from "@/ui/view/CorvoView";

export const CORVO_VIEW_TYPE = "corvo-main-view";
export const CORVO_ICON = "feather";

export function registerCorvoView(plugin: Obsidian.Plugin, dataStore: PluginDataStore): void {
  plugin.registerView(CORVO_VIEW_TYPE, (leaf) => new CorvoView(leaf, dataStore));

  plugin.addRibbonIcon(CORVO_ICON, "Abrir Corvo", () => openCorvoView(plugin));
  plugin.addCommand({
    id: "corvo-open-view",
    name: "Abrir painel do Corvo",
    callback: async () => {
      await openCorvoView(plugin);
    }
  });
}

export async function openCorvoView(plugin: Obsidian.Plugin): Promise<void> {
  const existingLeaf = plugin.app.workspace.getLeavesOfType(CORVO_VIEW_TYPE)[0];
  const leaf = existingLeaf ?? plugin.app.workspace.getLeaf();

  await leaf.setViewState({
    type: CORVO_VIEW_TYPE,
    active: true
  });

  await plugin.app.workspace.revealLeaf(leaf);
}
