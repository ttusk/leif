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

    expect(styles).toMatch(/\.leif-wall-primary\s*{[^}]*border-top:\s*1px solid var\(--leif-border\);/s);
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
});
