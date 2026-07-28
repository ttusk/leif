import { describe, expect, it } from "vitest";

import {
  Schema2Document,
  Schema2DocumentError,
  parseWikiLinkList,
  renderWikiLinkList
} from "@/infrastructure/markdown/schema2/Schema2Document";

const recursoSource = `---
leif-type: recurso
leif-schema: 2
leif-id: 01K2X7M4P8D1ABCDEFGHJKLMN0
formato: pdf
meta: 320
unidade: paginas
custom-key: preservado
---

# PDF 01

Notas livres.

## Assuntos

<!-- leif:assuntos:start -->
- [[../assuntos/concordancia/assunto|Concordância]]
- [[../assuntos/regencia/assunto]]
<!-- leif:assuntos:end -->
`;

describe("Schema2Document", () => {
  it("parses frontmatter identity, exactly one H1 and managed regions", () => {
    const document = Schema2Document.parse(recursoSource);

    expect(document.identity).toEqual({
      type: "recurso",
      schema: 2,
      id: "01K2X7M4P8D1ABCDEFGHJKLMN0"
    });
    expect(document.title).toBe("PDF 01");
    expect(document.property("custom-key")).toBe("preservado");
    expect(document.readRegion("assuntos")).toContain("[[../assuntos/concordancia/assunto");
  });

  it("rejects missing frontmatter, future schemas, merge conflicts and multiple H1s", () => {
    expect(() => Schema2Document.parse("# Sem frontmatter")).toThrow(Schema2DocumentError);
    expect(() =>
      Schema2Document.parse(recursoSource.replace("leif-schema: 2", "leif-schema: 99"))
    ).toThrow(/newer Leif version/i);
    expect(() => Schema2Document.parse(`${recursoSource}\n<<<<<<< HEAD\n`)).toThrow(
      /conflict markers/i
    );
    expect(() => Schema2Document.parse(`${recursoSource}\n# Outro H1\n`)).toThrow(
      /exactly one H1/i
    );
  });

  it("parses and renders ordered wikilink lists without requiring opaque ids", () => {
    expect(parseWikiLinkList(Schema2Document.parse(recursoSource).readRegion("assuntos"))).toEqual([
      { target: "../assuntos/concordancia/assunto", alias: "Concordância" },
      { target: "../assuntos/regencia/assunto" }
    ]);

    expect(
      renderWikiLinkList([
        { target: "materias/portugues/materia", alias: "Português" },
        { target: "materias/direito/materia" }
      ])
    ).toBe("1. [[materias/portugues/materia|Português]]\n2. [[materias/direito/materia]]");
  });

  it("replaces managed properties and regions while preserving unmanaged Markdown", () => {
    const document = Schema2Document.parse(recursoSource);
    const updated = document
      .replaceProperties(
        new Map([
          ["meta", "400"],
          ["unidade", "paginas"]
        ]),
        new Set(["meta", "unidade"])
      )
      .replaceRegion("assuntos", "- [[../assuntos/novo/assunto|Novo]]")
      .toString();

    expect(updated).toContain("meta: 400");
    expect(updated).toContain("custom-key: preservado");
    expect(updated).toContain("Notas livres.");
    expect(updated).toContain("- [[../assuntos/novo/assunto|Novo]]");
  });
});
