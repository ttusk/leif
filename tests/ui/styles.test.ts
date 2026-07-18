import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readStyles(): string {
  return readFileSync(resolve(process.cwd(), "styles.css"), "utf8");
}

describe("Leif visual system", () => {
  it("builds the interface from Obsidian theme tokens", () => {
    const styles = readStyles();

    expect(styles).toContain("--leif-surface: var(--background-secondary)");
    expect(styles).toContain("--leif-accent: var(--interactive-accent)");
    expect(styles).toContain("--leif-text: var(--text-normal)");
    expect(styles).toMatch(
      /\.leif-view\s*{[^}]*container-name:\s*leif;[^}]*container-type:\s*inline-size;/s
    );
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(styles).not.toMatch(/\.leif-(button|primary-button|input|select|textarea)\s*\{/);
  });

  it("uses a responsive workspace with a navigation rail on wide panes", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-workspace\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(148px,\s*184px\)\s+minmax\(0,\s*1fr\);/s
    );
    expect(styles).toMatch(
      /\.leif-navigation\s*{[^}]*position:\s*sticky;[^}]*align-self:\s*start;/s
    );
    expect(styles).not.toContain(".leif-navigation-label");
    expect(styles).toMatch(/\.leif-tab-bar\s*{[^}]*flex-direction:\s*column;/s);
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*760px\)[\s\S]*\.leif-workspace\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s
    );
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*760px\)[\s\S]*\.leif-tab-bar\s*{[^}]*flex-direction:\s*row;[^}]*overflow-x:\s*auto;/s
    );
    expect(styles).toMatch(
      /\.leif-view\.is-narrow\s+\.leif-workspace\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s
    );
    expect(styles).toMatch(
      /\.leif-view\.is-narrow\s+\.leif-tab-bar\s*{[^}]*flex-direction:\s*row;[^}]*overflow-x:\s*auto;/s
    );
    expect(styles).not.toContain("scrollbar-width");
  });

  it("gives semantic tabs a native, visible active state", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-tab-button\s*{[^}]*min-height:\s*40px;[^}]*border-radius:\s*var\(--radius-s\);/s
    );
    expect(styles).toMatch(
      /\.leif-tab-button\.is-active\s*{[^}]*background:\s*var\(--background-modifier-hover\);[^}]*color:\s*var\(--text-normal\);/s
    );
    expect(styles).toMatch(
      /\.leif-tab-button:focus-visible\s*{[^}]*box-shadow:\s*0 0 0 2px var\(--background-modifier-border-focus\);/s
    );
    expect(styles).toMatch(/\.leif-tab-icon\s*{[^}]*color:\s*var\(--text-muted\);/s);
  });

  it("keeps content readable and data surfaces scrollable", () => {
    const styles = readStyles();

    expect(styles).toMatch(/\.leif-view\s*{[^}]*height:\s*100%;[^}]*overflow-y:\s*auto;/s);
    expect(styles).toMatch(/\.leif-body\s*{[^}]*min-width:\s*0;[^}]*max-width:\s*980px;/s);
    expect(styles).toMatch(/\.leif-table-wrapper\s*{[^}]*overflow:\s*auto;/s);
    expect(styles).not.toMatch(/\.leif-table-wrapper\s*{[^}]*scrollbar-gutter:\s*stable;/s);
    expect(styles).toMatch(/\.leif-table thead th\s*{[^}]*position:\s*sticky;/s);
  });

  it("uses a flat hierarchy with only purposeful containers", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-next-activity\s*{[^}]*background:\s*var\(--leif-surface\);[^}]*border:\s*1px solid var\(--leif-border\);/s
    );
    expect(styles).not.toContain(".leif-next-activity::before");
    expect(styles).toMatch(
      /\.leif-card\s*{[^}]*padding:\s*0;[^}]*background:\s*transparent;[^}]*border:\s*0;/s
    );
    expect(styles).toMatch(/\.leif-next-activity-next\s*{[^}]*border-top:\s*0;/s);
    expect(styles).toMatch(/\.leif-empty-state\s*{[^}]*border-style:\s*dashed;/s);
  });

  it("supports touch targets, narrow forms, reduced motion, and forced colors", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /@media\s*\(max-width:\s*760px\)[\s\S]*\.leif-inline-actions button[\s\S]*min-height:\s*40px;/s
    );
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*520px\)[\s\S]*\.leif-form-actions\s*{[^}]*flex-direction:\s*column-reverse;/s
    );
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(styles).toMatch(/@media\s*\(forced-colors:\s*active\)/);
  });

  it("shows partial progress visually and completion as a compact status", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-progress-bar\s*{[^}]*background:\s*var\(--background-modifier-border\);/s
    );
    expect(styles).toMatch(/\.leif-progress-fill\s*{[^}]*background:\s*var\(--leif-accent\);/s);
    expect(styles).toMatch(/\.leif-progress-complete\s*{[^}]*color:\s*var\(--text-success\);/s);
  });

  it("shows the active contest as quiet green text instead of a filled pill", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-status-active\s*{[^}]*padding:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*color:\s*var\(--text-success\);/s
    );
  });

  it("shows active and inactive subjects as flat semantic text", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-cycle-status\s*{[^}]*padding:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;/s
    );
    expect(styles).toMatch(
      /\.leif-cycle-status\.leif-status-active\s*{[^}]*color:\s*var\(--text-success\);/s
    );
    expect(styles).toMatch(
      /\.leif-cycle-status\.leif-status-inactive\s*{[^}]*color:\s*var\(--text-warning\);/s
    );
  });

  it("centers shared icons against adjacent text", () => {
    const styles = readStyles();

    expect(styles).toMatch(/\.leif-icon\s*{[^}]*line-height:\s*0;/s);
    expect(styles).toMatch(
      /\.leif-icon\s*>\s*svg\s*{[^}]*display:\s*block;[^}]*width:\s*100%;[^}]*height:\s*100%;/s
    );
  });

  it("keeps the subject picker flat around the native select", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-subject-picker\s*{[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*background:\s*transparent;/s
    );
  });

  it("styles URL controls as full-width icon fields", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-url-field\s*{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s
    );
    expect(styles).toMatch(/\.leif-url-control\s*{[^}]*position:\s*relative;/s);
    expect(styles).toMatch(
      /\.leif-url-control input\s*{[^}]*width:\s*100%;[^}]*padding-inline-start:/s
    );
  });
});
