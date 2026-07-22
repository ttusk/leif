import { Notice, Plugin } from "obsidian";

import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { StagedMarkdownMigrationService } from "@/application/services/StagedMarkdownMigrationService";
import { MigrationConfirmModal } from "@/ui/migration/MigrationConfirmModal";

export function registerMarkdownMigration(
  plugin: Plugin,
  dataStore: PluginDataStore,
  migration: StagedMarkdownMigrationService
): void {
  plugin.addCommand({
    id: "migrate-active-contest-to-markdown",
    name: "Migrar concurso ativo para Markdown",
    callback: async () => {
      const data = await dataStore.load();
      const contest = data.contests.find((candidate) => candidate.id === data.activeContestId);
      if (!contest) {
        new Notice("Selecione um concurso antes de iniciar a migração.");
        return;
      }
      if (data.runtimeState!.contestStorage[contest.id] === "vault-markdown") {
        new Notice("Este concurso já usa Markdown como fonte.");
        return;
      }
      new MigrationConfirmModal(plugin.app, contest.name, contest.id, migration).open();
    }
  });
}
