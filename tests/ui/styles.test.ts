import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Leif styles", () => {
  it("lets the whole extension page scroll when content is taller than the pane", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    expect(styles).toMatch(/\.leif-view\s*{[^}]*height:\s*100%;/s);
    expect(styles).toMatch(/\.leif-view\s*{[^}]*overflow-y:\s*auto;/s);
    expect(styles).toMatch(/\.leif-view\s*{[^}]*overflow-x:\s*hidden;/s);
    expect(styles).toMatch(/\.leif-shell\s*{[^}]*min-height:\s*0;/s);
  });

  it("keeps accumulated tables inside a scrollable viewport", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    expect(styles).toMatch(/\.leif-table-wrapper\s*{[^}]*max-height:\s*min\(52vh,\s*520px\);/s);
    expect(styles).toMatch(/\.leif-table-wrapper\s*{[^}]*overflow:\s*auto;/s);
    expect(styles).toMatch(/\.leif-table thead th\s*{[^}]*position:\s*sticky;/s);
  });

  it("does not darken expanded resource detail rows on table hover", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    expect(styles).toMatch(/\.leif-table tbody tr\.leif-detail-row:hover\s*{[^}]*background:\s*transparent;/s);
  });

  it("keeps expanded resource details free from stacked divider lines", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    expect(styles).toMatch(/\.leif-resource-detail \.leif-section-subtitle\s*{[^}]*border-bottom:\s*0;/s);
    expect(styles).toMatch(/\.leif-resource-detail \.leif-detail-list\s*{[^}]*border:\s*0;/s);
    expect(styles).toMatch(/\.leif-resource-detail \.leif-detail-list-item \+ \.leif-detail-list-item\s*{[^}]*border-top:\s*0;/s);
    expect(styles).toMatch(/\.leif-resource-material-form\s*{[^}]*border-top:\s*0;/s);
  });

  it("keeps wall notes as the primary full-width area with compact references below", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    expect(styles).toMatch(/\.leif-wall-primary\s*{[^}]*border:\s*0;/s);
    expect(styles).toMatch(/\.leif-wall-reference-grid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s);
    expect(styles).toMatch(/\.leif-wall-save\s*{[^}]*align-self:\s*flex-end;/s);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.leif-wall-reference-grid\s*{[^}]*grid-template-columns:\s*1fr;/);
  });

  it("leans on Obsidian theme tokens for native-looking controls", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    expect(styles).toMatch(/--leif-radius:\s*var\(--radius-s\);/);
    expect(styles).not.toContain("#7c3aed");
  });

  it("does not restyle controls that Obsidian already provides", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    expect(styles).not.toMatch(/\.leif-button\s*{/);
    expect(styles).not.toMatch(/\.leif-primary-button\s*{/);
    expect(styles).not.toMatch(/\.leif-icon-button\s*{/);
    expect(styles).not.toMatch(/\.leif-input,\s*\n\.leif-select,\s*\n\.leif-textarea\s*{/);
    expect(styles).not.toMatch(/\.leif-modal-card\s*{/);
    expect(styles).not.toMatch(/\.leif-(label|input-compact|textarea|modal)\b/);
    expect(styles).not.toMatch(/\.leif-form\s*{/);
  });

  it("keeps the revamp flat without decorative dots, side rails, or right-heavy activity cards", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    [
      ".leif-status-active::before",
      ".leif-section-title::before",
      ".leif-next-activity::before",
      ".leif-cycle-context::before",
      ".leif-cycle-card::before",
      ".leif-contest-card::before",
      ".leif-wall-snapshot-card::before"
    ].forEach((selector) => {
      expect(styles).not.toContain(selector);
    });
    const leftBorderValues = Array.from(styles.matchAll(/border-left:\s*([^;]+);/g)).map(
      (match) => match[1]?.trim()
    );
    expect(leftBorderValues.every((value) => value === "0")).toBe(true);
    expect(styles).toMatch(/\.leif-next-activity\s*{[^}]*flex-direction:\s*column;/s);
    expect(styles).toMatch(/\.leif-next-activity-meta\s*{[^}]*display:\s*grid;[^}]*width:\s*100%;/s);
    expect(styles).toMatch(/\.leif-next-activity-next\s*{[^}]*width:\s*100%;[^}]*text-align:\s*left;/s);
    expect(styles).toMatch(/\.leif-cycle-context-next\s*{[^}]*flex-basis:\s*100%;[^}]*margin-left:\s*0;/s);
    expect(styles).toMatch(/\.leif-contest-card\s*{[^}]*grid-template-columns:\s*minmax\(260px,\s*0\.9fr\)\s*minmax\(260px,\s*1\.1fr\);/s);
    expect(styles).toMatch(/\.leif-contest-notes\s*{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1 \/ span 2;/s);
    expect(styles).toMatch(/\.leif-body\s*{[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
    expect(styles).toMatch(/\.leif-card,\s*\n\.leif-empty-state\s*{[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
    expect(styles).toMatch(/\.leif-session-filters\s*{[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
    expect(styles).toMatch(/\.leif-progress-bar\s*{[^}]*box-sizing:\s*border-box;[^}]*max-width:\s*320px;/s);
    expect(styles).toMatch(/\.leif-progress-fill\s*{[^}]*display:\s*block;/s);
  });

  it("keeps progress fill visually distinct from the track", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    expect(styles).toMatch(/--leif-progress-track:\s*color-mix\(in srgb,\s*var\(--leif-border\)\s*38%,\s*transparent\);/);
    expect(styles).toMatch(/--leif-progress-fill:\s*color-mix\(in srgb,\s*var\(--interactive-accent\)\s*82%,\s*var\(--text-normal\)\);/);
    expect(styles).toMatch(/\.leif-progress-bar\s*{[^}]*background:\s*var\(--leif-progress-track\);/s);
    expect(styles).toMatch(/\.leif-progress-fill\s*{[^}]*background:\s*var\(--leif-progress-fill\);/s);
    expect(styles).toMatch(/\.leif-progress-fill\.is-complete\s*{[^}]*background:\s*var\(--leif-progress-complete\);/s);
  });

  it("keeps tabs minimalist with text-only active state and no border-like markers", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    expect(styles).toMatch(/\/\* Minimal tab index: text only, no border marks\. \*\//);
    expect(styles).toMatch(/\.leif-tab-bar\s*{[^}]*gap:\s*clamp\(14px,\s*2\.4vw,\s*28px\);[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
    expect(styles).toMatch(/\.leif-tab-button\s*{[^}]*display:\s*inline-flex;[^}]*flex:\s*0 0 auto;[^}]*min-height:\s*32px;[^}]*padding:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s);
    expect(styles).toMatch(/\.leif-tab-button\s*{[^}]*cursor:\s*pointer;[^}]*user-select:\s*none;/s);
    expect(styles).toMatch(/\.leif-tab-button::before\s*{[^}]*content:\s*none;/s);
    expect(styles).toMatch(/\.leif-tab-button:hover\s*{[^}]*background:\s*transparent;/s);
    expect(styles).toMatch(/\.leif-tab-button\.is-active\s*{[^}]*background:\s*transparent;[^}]*color:\s*var\(--text-normal\);[^}]*font-weight:\s*760;/s);
  });

  it("applies a divider diet so flat pages are grouped by space instead of stacked rules", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    expect(styles).toMatch(/\/\* Divider diet: keep structure quiet and let spacing do the grouping\. \*\//);
    expect(styles).toMatch(/\.leif-section-header,\s*\n\.leif-section-subtitle,\s*\n\.leif-cycle-summary\s*{[^}]*border-bottom:\s*0;/s);
    expect(styles).toMatch(/\.leif-table-wrapper,\s*\nform\.leif-card,[\s\S]*?\.leif-wall-primary\s*{[^}]*border:\s*0;/s);
    expect(styles).toMatch(/\.leif-table th,\s*\n\.leif-table td,\s*\n\.leif-detail-row\s*{[^}]*border-top:\s*0;/s);
    expect(styles).toMatch(/\.leif-table tbody tr \+ tr td\s*{[^}]*padding-top:\s*14px;/s);
    expect(styles).toMatch(/\.leif-tab-button\s*{[^}]*border-right:\s*0;/s);
  });

  it("adds only punctual separators between major groups, not inside every row", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");

    expect(styles).toMatch(/\/\* Punctual separators: only between major groups\. \*\//);
    expect(styles).toMatch(/\.leif-body > \.leif-card \+ \.leif-card,\s*\n\.leif-body > \.leif-empty-state \+ \.leif-card\s*{[^}]*border-top:\s*1px solid var\(--leif-hairline\);/s);
    expect(styles).toMatch(/\.leif-next-activity \+ \.leif-card,\s*\n\.leif-cycle-context \+ \.leif-cycle-action,\s*\n\.leif-cycle-action \+ \.leif-card\s*{[^}]*border-top:\s*1px solid var\(--leif-hairline\);/s);
    expect(styles).toMatch(/form\.leif-card \+ \.leif-card\s*{[^}]*border-top:\s*1px solid var\(--leif-hairline\);/s);
    expect(styles).toMatch(/\.leif-table th,\s*\n\.leif-table td,\s*\n\.leif-detail-row\s*{[^}]*border-top:\s*0;/s);
  });
});
