import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readStyles(): string {
  return readFileSync(resolve(process.cwd(), "styles.css"), "utf8");
}

describe("Leif Native visual system", () => {
  it("aliases Obsidian theme tokens without shipping a Leif palette or font", () => {
    const styles = readStyles();

    expect(styles).toContain("--leif-bg: var(--background-primary)");
    expect(styles).toContain("--leif-bg-muted: var(--background-secondary)");
    expect(styles).toContain("--leif-bg-editing: var(--background-primary-alt)");
    expect(styles).toContain("--leif-accent: var(--interactive-accent)");
    expect(styles).toContain("--leif-text: var(--text-normal)");
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    const fontFamilies = Array.from(styles.matchAll(/font-family:\s*([^;]+);/gi)).map((match) =>
      match[1].trim()
    );
    expect(fontFamilies.every((value) => value.startsWith("var("))).toBe(true);
    expect(styles).not.toContain("--leif-shadow");
  });

  it("uses a horizontal text navigation instead of an internal app rail", () => {
    const styles = readStyles();

    expect(styles).toMatch(/\.leif-workspace\s*{[^}]*display:\s*block;/s);
    expect(styles).toMatch(
      /\.leif-tab-bar\s*{[^}]*display:\s*flex;[^}]*flex-direction:\s*row;[^}]*overflow-x:\s*auto;/s
    );
    expect(styles).toMatch(
      /\.leif-view button\.leif-tab-button\.is-active\s*{[^}]*border-bottom-color:\s*var\(--leif-accent\);/s
    );
    expect(styles).not.toMatch(/grid-template-columns:\s*minmax\(148px,\s*184px\)/);
    expect(styles).not.toContain(".leif-tab-icon");
  });

  it("wins over Obsidian theme button chrome on navigation tabs", () => {
    const styles = readStyles();
    const reset = styles.match(/\.leif-view button\.leif-tab-button\s*{([^}]*)}/s)?.[1] ?? "";
    const active =
      styles.match(/\.leif-view button\.leif-tab-button\.is-active\s*{([^}]*)}/s)?.[1] ?? "";

    expect(reset).toContain("appearance: none;");
    expect(reset).toContain("border: 0;");
    expect(reset).toContain("background: transparent;");
    expect(reset).toContain("box-shadow: none;");
    expect(active).toContain("border-bottom-color: var(--leif-accent);");
    expect(active).toContain("background: transparent;");
    expect(active).toContain("box-shadow: none;");
  });

  it("keeps content compact and lets the pane width drive reflow", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-view\s*{[^}]*container-name:\s*leif;[^}]*container-type:\s*inline-size;/s
    );
    expect(styles).toMatch(/\.leif-body\s*{[^}]*max-width:\s*960px;/s);
    expect(styles).toMatch(
      /\.leif-view\.is-compact[\s\S]*\.leif-grid-2\s*{[^}]*grid-template-columns:\s*1fr;/s
    );
    expect(styles).toMatch(/\.leif-table-wrapper\s*{[^}]*overflow-x:\s*auto;/s);
  });

  it("keeps quantity, unit, and correct answers side by side on wide panes", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-record-fields\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s
    );
    expect(styles).toMatch(
      /\.leif-view\.is-narrow[\s\S]*?\.leif-record-fields\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s
    );
    expect(styles).toMatch(
      /\.leif-view\.is-compact[\s\S]*?\.leif-record-fields[\s\S]*?grid-template-columns:\s*1fr;/s
    );
  });

  it("uses proximity and sparse dividers instead of cards and shadows", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-card\s*{[^}]*padding:\s*0;[^}]*background:\s*transparent;[^}]*border:\s*0;/s
    );
    expect(styles).toMatch(
      /\.leif-wall-editor\s*{[^}]*background:\s*var\(--leif-bg-editing\);[^}]*border:\s*1px solid var\(--leif-border-hover\);/s
    );
    expect(styles).toMatch(
      /\.leif-empty-state\s*{[^}]*background:\s*var\(--leif-bg-muted\);[^}]*border:\s*0;/s
    );
    expect(styles).not.toMatch(/border-style:\s*dashed/);
    expect(styles).not.toMatch(/box-shadow:\s*var\(--shadow/);
  });

  it("does not ship the old Fio do ciclo timeline markers", () => {
    const styles = readStyles();

    expect(styles).not.toContain(".leif-cycle-thread");
    expect(styles).not.toContain(".leif-cycle-thread-step");
    expect(styles).not.toMatch(/\.leif-next-activity\s*{[^}]*box-shadow:/s);
  });

  it("stacks Mural sections and keeps long reference data readable", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-wall-read-view\s*{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s
    );
    expect(styles).toMatch(
      /\.leif-wall-editor\s*{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s
    );
    expect(styles).not.toContain("grid-template-rows: subgrid");
  });

  it("retains accessible focus, reduced motion, forced colors, and touch targets", () => {
    const styles = readStyles();

    expect(styles).toMatch(/\.leif-view button\.leif-tab-button:focus-visible\s*{[^}]*outline:/s);
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(styles).toMatch(/@media\s*\(forced-colors:\s*active\)/);
    expect(styles).toMatch(/\.leif-view\.is-compact[\s\S]*button[^}]*min-height:\s*40px;/s);
  });

  it("keeps numeric progress scannable without metric-card styling", () => {
    const styles = readStyles();

    expect(styles).toMatch(/\.leif-metric-value\s*{[^}]*font-variant-numeric:\s*tabular-nums;/s);
    expect(styles).toMatch(/\.leif-progress-fill\s*{[^}]*background:\s*var\(--leif-accent\);/s);
    expect(styles).toMatch(/\.leif-status-(active|inactive)\s*{[^}]*background:\s*transparent;/s);
    expect(styles).toMatch(/\.leif-topic-progress-cell\s*{[^}]*white-space:\s*nowrap;/s);
  });

  it("keeps multi-digit reorder positions on one line", () => {
    const styles = readStyles();

    expect(styles).toMatch(/\.leif-order-control\s*{[^}]*white-space:\s*nowrap;/s);
    expect(styles).toMatch(/\.leif-order-number\s*{[^}]*min-width:\s*2ch;/s);
  });

  it("keeps cycle status labels like No ciclo on one line", () => {
    const styles = readStyles();

    expect(styles).toMatch(/\.leif-status-(active|inactive)\s*{[^}]*white-space:\s*nowrap;/s);
  });

  it("spaces cycle summary chips so Matérias, No ciclo and Tempo total are not colliding", () => {
    const styles = readStyles();

    expect(styles).toMatch(/\.leif-cycle-summary\s*{[^}]*display:\s*flex;[^}]*gap:/s);
    expect(styles).toMatch(/\.leif-cycle-summary-chip\s*{[^}]*gap:/s);
  });

  it("keeps descriptive table names readable without truncation or mid-word breaks", () => {
    const styles = readStyles();

    const baseCell = styles.match(/\.leif-table\s+th,\s*\.leif-table\s+td\s*{([^}]*)}/s)?.[1] ?? "";
    expect(baseCell).not.toMatch(/overflow-wrap:\s*anywhere/);
    expect(baseCell).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(baseCell).not.toMatch(/white-space:\s*nowrap/);

    expect(styles).toMatch(/\.leif-table-cell-name\s*{[^}]*overflow-wrap:\s*break-word;/s);
    expect(styles).not.toMatch(/\.leif-table-cell-name\s*{[^}]*white-space:\s*nowrap/s);
  });

  it("pins the Actions column as a sticky opaque final column that shares row state", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-table-actions\s*{[^}]*position:\s*sticky;[^}]*right:\s*0;[^}]*background:/s
    );
    expect(styles).toMatch(/\.leif-table-actions\s*{[^}]*white-space:\s*nowrap;/s);
    expect(styles).toMatch(
      /\.leif-table\s+tbody\s+tr[\s\S]*?\.leif-table-actions\s*{[^}]*background:\s*var\(--background-modifier-hover\);/s
    );
    expect(styles).toMatch(
      /\.leif-editing-row\s*>\s*\.leif-table-actions\s*{[^}]*background:\s*var\(--leif-bg-editing\);/s
    );
  });

  it("keeps status and numeric table cells on one line", () => {
    const styles = readStyles();

    expect(styles).toMatch(/\.leif-table-cell-numeric\s*{[^}]*white-space:\s*nowrap;/s);
    expect(styles).toMatch(/\.leif-status-(active|inactive)\s*{[^}]*white-space:\s*nowrap;/s);
  });

  it("preserves usable touch targets in compact panes for table action controls", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.leif-view\.is-compact[\s\S]*?\.leif-table-actions[^}]*min-height:\s*40px;/s
    );
  });

  it("lets the table wrapper own horizontal overflow while the table keeps sensible bounds", () => {
    const styles = readStyles();

    expect(styles).toMatch(/\.leif-table-wrapper\s*{[^}]*overflow-x:\s*auto;/s);
    expect(styles).toMatch(/\.leif-table\s*{[^}]*min-width:/s);
    expect(styles).toMatch(/\.leif-table-cell-name\s*{[^}]*min-width:/s);
  });

  it("keeps readable contest and long reference content from breaking mid-word", () => {
    const styles = readStyles();

    expect(styles).not.toContain(".leif-contest-menu");
    expect(styles).not.toContain(".leif-contest-option");
    expect(styles).not.toContain(".leif-contest-card");
  });
});
