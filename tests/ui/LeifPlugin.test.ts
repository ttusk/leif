// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import LeifPlugin from "@/main";
import { App, getOpenModals, Plugin, resetOpenModals } from "../mocks/obsidian";
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
      "migrate-active-contest-to-markdown"
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
    existing.runtimeState = {
      ...existing.runtimeState!,
      lastAcknowledgedVersion: "1.0.2"
    };
    await plugin.saveData(existing);

    await plugin.onload();
    await Promise.resolve();

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
});
