import * as Obsidian from "obsidian";

import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { LeifView } from "@/ui/view/LeifView";
import { t } from "@/ui/i18n";

export const LEIF_VIEW_TYPE = "leif-main-view";
export const LEIF_ICON = "feather";

export function registerLeifView(plugin: Obsidian.Plugin, dataStore: PluginDataStore): void {
  plugin.registerView(LEIF_VIEW_TYPE, (leaf) => new LeifView(leaf, dataStore));

  plugin.addRibbonIcon(LEIF_ICON, "Abrir Leif", () => openLeifView(plugin));
  plugin.addCommand({
    id: "leif-open-view",
    name: t("command.openView"),
    callback: async () => {
      await openLeifView(plugin);
    }
  });
}

export async function openLeifView(plugin: Obsidian.Plugin): Promise<void> {
  const existingLeaf = plugin.app.workspace.getLeavesOfType(LEIF_VIEW_TYPE)[0];
  const leaf = existingLeaf ?? plugin.app.workspace.getLeaf();

  await leaf.setViewState({
    type: LEIF_VIEW_TYPE,
    active: true
  });

  await plugin.app.workspace.revealLeaf(leaf);
}
