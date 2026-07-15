// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import LeifPlugin from "@/main";
import { App, Plugin } from "../mocks/obsidian";

describe("LeifPlugin", () => {
  it("does not register an Obsidian settings tab", async () => {
    const app = new App();
    const plugin = new LeifPlugin(app as never, {} as never);

    await plugin.onload();

    expect((plugin as unknown as Plugin).settingTabs).toHaveLength(0);
  });
});
