import { describe, expect, it } from "vitest";

import {
  ManagedMarkdownDocument,
  MarkdownDocumentError
} from "@/infrastructure/markdown/ManagedMarkdownDocument";

const SOURCE = `---
leif-type: materia
leif-schema: 1
leif-id: subject-1
custom-property: keep-me
---
# Português

Anotações livres do usuário.

<!-- leif:topics:start -->
- [ ] Sintaxe ^leif-topic-topic-1
<!-- leif:topics:end -->

Texto final que o Leif não administra.
`;

describe("ManagedMarkdownDocument", () => {
  it("reads the identity contract and preserves unknown properties", () => {
    const document = ManagedMarkdownDocument.parse(SOURCE);

    expect(document.identity).toEqual({ type: "materia", schema: 1, id: "subject-1" });
    expect(document.properties.get("custom-property")).toBe("keep-me");
  });

  it("patches only one managed region and preserves human-authored bytes around it", () => {
    const document = ManagedMarkdownDocument.parse(SOURCE);
    const updated = document.replaceRegion(
      "topics",
      "- [ ] Sintaxe ^leif-topic-topic-1\n- [ ] Semântica ^leif-topic-topic-2"
    );

    expect(updated).toContain("Anotações livres do usuário.");
    expect(updated).toContain("custom-property: keep-me");
    expect(updated).toContain("Texto final que o Leif não administra.");
    expect(updated).toContain("- [ ] Semântica ^leif-topic-topic-2");
  });

  it.each([
    ["future schema", SOURCE.replace("leif-schema: 1", "leif-schema: 2"), "future-schema"],
    ["merge conflict", `${SOURCE}\n<<<<<<< HEAD\n`, "merge-conflict"],
    [
      "duplicate managed region",
      `${SOURCE}\n<!-- leif:topics:start -->\n<!-- leif:topics:end -->\n`,
      "duplicate-region"
    ],
    ["missing identity", SOURCE.replace("leif-id: subject-1\n", ""), "missing-property"]
  ])("blocks %s documents before a write", (_name, source, code) => {
    expect(() => ManagedMarkdownDocument.parse(source)).toThrowError(
      expect.objectContaining<Partial<MarkdownDocumentError>>({
        code: code as MarkdownDocumentError["code"]
      })
    );
  });

  it("refuses to patch a region that is absent instead of guessing an insertion point", () => {
    const document = ManagedMarkdownDocument.parse(
      SOURCE.replace(/<!-- leif:topics:[\s\S]*?end -->\n/, "")
    );

    expect(() => document.replaceRegion("topics", "new content")).toThrowError(
      expect.objectContaining({ code: "missing-region" })
    );
  });

  it("patches managed properties while preserving unknown frontmatter and prose", () => {
    const document = ManagedMarkdownDocument.parse(SOURCE);
    const updated = document.replaceProperties(
      new Map([
        ["leif-type", "materia"],
        ["leif-schema", "1"],
        ["leif-id", "subject-1"],
        ["name", "Língua Portuguesa"]
      ]),
      new Set(["leif-type", "leif-schema", "leif-id", "name", "stage"])
    );

    expect(updated).toContain('name: "Língua Portuguesa"');
    expect(updated).toContain("custom-property: keep-me");
    expect(updated).toContain("Anotações livres do usuário.");
  });
});
