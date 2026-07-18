// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import LeifPlugin from "@/main";
import { App, Plugin } from "../mocks/obsidian";

describe("LeifPlugin", () => {
  it("registers only the production view command and no settings tab", async () => {
    const app = new App();
    const plugin = new LeifPlugin(app as never, {} as never);

    await plugin.onload();

    const registeredPlugin = plugin as unknown as Plugin;
    expect(registeredPlugin.settingTabs).toHaveLength(0);
    expect(registeredPlugin.commands.map((command) => command.id)).toEqual(["open-view"]);
    expect(registeredPlugin.commands[0]?.name).toBe("Abrir painel");
  });
});
