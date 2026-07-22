// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import LeifPlugin from "@/main";
import { App, getOpenModals, Plugin, resetOpenModals, Vault } from "../mocks/obsidian";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";

describe("LeifPlugin", () => {
  it("registers the panel and safe Markdown migration commands with no settings tab", async () => {
    const app = new App();
    const plugin = new LeifPlugin(app as never, {} as never);

    await plugin.onload();

    const registeredPlugin = plugin as unknown as Plugin;
    expect(registeredPlugin.settingTabs).toHaveLength(0);
    expect(registeredPlugin.commands.map((command) => command.id)).toEqual([
      "open-view",
      "migrate-active-contest-to-markdown",
      "rollback-active-contest-to-legacy-json"
    ]);
    expect(registeredPlugin.commands[0]?.name).toBe("Abrir painel");
  });

  it("silently records the current version for a fresh install", async () => {
    resetOpenModals();
    const plugin = new LeifPlugin(new App() as never, { version: "2.0.0" } as never);

    await plugin.onload();
    await Promise.resolve();

    expect(getOpenModals()).toHaveLength(0);
    const saved = (await plugin.loadData()) as ReturnType<typeof createDefaultLeifPluginData>;
    expect(saved.runtimeState?.lastAcknowledgedVersion).toBe("2.0.0");
  });

  it("shows bundled notes after an update and acknowledges them explicitly", async () => {
    resetOpenModals();
    const plugin = new LeifPlugin(new App() as never, { version: "2.0.0" } as never);
    const existing = createDefaultLeifPluginData();
    existing.contests.push({
      id: "contest-1",
      name: "TRT",
      subjectIds: [],
      wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
    });
    delete existing.runtimeState;
    await plugin.saveData(existing);

    await plugin.onload();
    await Promise.resolve();

    const backups = await plugin.app.vault.adapter.list("Leif/.backups/upgrades");
    const backup = backups.files.find((path) => path.includes("/v1-to-v2-"));
    expect(backup).toBeDefined();
    expect(await plugin.app.vault.adapter.read(backup!)).toContain('"contest-1"');

    const [modal] = getOpenModals();
    expect(modal?.contentEl.textContent).toContain("Leif 2.0");
    expect(modal?.contentEl.querySelector("a")?.getAttribute("href")).toContain(
      "/releases/tag/2.0.0"
    );

    (modal?.contentEl.querySelector("button") as HTMLButtonElement).click();
    await vi.waitFor(async () => {
      const saved = (await plugin.loadData()) as ReturnType<typeof createDefaultLeifPluginData>;
      expect(saved.runtimeState?.lastAcknowledgedVersion).toBe("2.0.0");
    });
  });

  it("fails closed before registering writable UI when a legacy backup cannot be created", async () => {
    class FailingBackupVault extends Vault {
      constructor() {
        super();
        const write = this.adapter.write;
        this.adapter.write = async (path: string, content: string) => {
          if (path.startsWith("Leif/.backups/upgrades/")) throw new Error("disk full");
          await write(path, content);
        };
      }
    }

    const app = new App();
    app.vault = new FailingBackupVault();
    const plugin = new LeifPlugin(app as never, { version: "2.0.0" } as never);
    const existing = createDefaultLeifPluginData();
    delete existing.runtimeState;
    existing.contests.push({
      id: "contest-1",
      name: "TRT",
      subjectIds: [],
      wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
    });
    await plugin.saveData(existing);

    await expect(plugin.onload()).rejects.toThrow(/disk full/i);
    expect((plugin as unknown as Plugin).commands).toHaveLength(0);
    expect(await plugin.loadData()).toEqual(existing);
  });
});
