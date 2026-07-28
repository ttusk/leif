import { describe, expect, it } from "vitest";

import {
  Schema2WorkspaceIndex,
  Schema2WorkspaceIndexError
} from "@/infrastructure/markdown/schema2/Schema2WorkspaceIndex";

function doc(type: string, id: string, title: string, extra = ""): string {
  return `---
leif-type: ${type}
leif-schema: 2
leif-id: ${id}
${extra}---

# ${title}
`;
}

const files = [
  {
    path: "Leif/concursos/trt/concurso.md",
    content: `${doc("concurso", "contest-1", "TRT")}## Ordem do ciclo

<!-- leif:materias:start -->
1. [[materias/portugues/materia|Português]]
<!-- leif:materias:end -->
`
  },
  {
    path: "Leif/concursos/trt/mural.md",
    content: doc("mural", "mural-1", "Mural")
  },
  {
    path: "Leif/concursos/trt/materias/portugues/materia.md",
    content: `${doc("materia", "subject-1", "Português", "ativa: true\n")}## Assuntos

<!-- leif:assuntos:start -->
1. [[assuntos/concordancia/assunto|Concordância]]
<!-- leif:assuntos:end -->

## Recursos

<!-- leif:recursos:start -->
1. [[recursos/pdf-01/recurso|PDF 01]]
<!-- leif:recursos:end -->
`
  },
  {
    path: "Leif/concursos/trt/materias/portugues/assuntos/concordancia/assunto.md",
    content: doc("assunto", "topic-1", "Concordância")
  },
  {
    path: "Leif/concursos/trt/materias/portugues/recursos/pdf-01/recurso.md",
    content: `${doc("recurso", "resource-1", "PDF 01", "meta: 80\nunidade: paginas\n")}## Assuntos

<!-- leif:assuntos:start -->
- [[../../assuntos/concordancia/assunto|Concordância]]
<!-- leif:assuntos:end -->
`
  },
  {
    path: "Leif/concursos/trt/sessoes/2026-07/2026-07-27/sessao.md",
    content: `${doc("sessao", "session-1", "Sessão 2026-07-27", "data: 2026-07-27\n")}## Registros

<!-- leif:registros:start -->
1. [[registros/leitura-pdf-01|Leitura PDF 01]]
<!-- leif:registros:end -->
`
  },
  {
    path: "Leif/concursos/trt/sessoes/2026-07/2026-07-27/registros/leitura-pdf-01.md",
    content: doc(
      "registro",
      "record-1",
      "Leitura PDF 01",
      'materia: "[[../../../materias/portugues/materia]]"\nrecurso: "[[../../../materias/portugues/recursos/pdf-01/recurso]]"\natividade: leitura\n'
    )
  }
];

describe("Schema2WorkspaceIndex", () => {
  it("infers containment from canonical schema-2 paths", () => {
    const index = Schema2WorkspaceIndex.build(files);

    expect(index.contests).toMatchObject([
      { id: "contest-1", path: "Leif/concursos/trt/concurso.md" }
    ]);
    expect(index.subjects).toMatchObject([
      {
        id: "subject-1",
        contestId: "contest-1",
        path: "Leif/concursos/trt/materias/portugues/materia.md"
      }
    ]);
    expect(index.topics).toMatchObject([{ id: "topic-1", subjectId: "subject-1" }]);
    expect(index.resources).toMatchObject([{ id: "resource-1", subjectId: "subject-1" }]);
    expect(index.sessions).toMatchObject([{ id: "session-1", contestId: "contest-1" }]);
    expect(index.records).toMatchObject([{ id: "record-1", sessionId: "session-1" }]);
    expect(index.murals).toMatchObject([{ id: "mural-1", contestId: "contest-1" }]);
  });

  it("resolves relative wikilinks using deterministic Obsidian-like paths", () => {
    const index = Schema2WorkspaceIndex.build(files);

    expect(
      index.resolveWikiLink(
        "Leif/concursos/trt/materias/portugues/recursos/pdf-01/recurso.md",
        "../../assuntos/concordancia/assunto"
      )
    ).toMatchObject({ id: "topic-1", type: "assunto" });
    expect(
      index.resolveWikiLink(
        "Leif/concursos/trt/sessoes/2026-07/2026-07-27/registros/leitura-pdf-01.md",
        "../../../materias/portugues/recursos/pdf-01/recurso"
      )
    ).toMatchObject({ id: "resource-1", type: "recurso" });
  });

  it("rejects duplicate ids and ambiguous wikilinks", () => {
    expect(() =>
      Schema2WorkspaceIndex.build([
        files[0],
        { path: "Leif/concursos/outro/concurso.md", content: doc("concurso", "contest-1", "Outro") }
      ])
    ).toThrow(Schema2WorkspaceIndexError);

    const ambiguous = Schema2WorkspaceIndex.build([
      files[0],
      {
        path: "Leif/concursos/trt/materias/a/assuntos/topico/assunto.md",
        content: doc("assunto", "topic-a", "Tópico")
      },
      {
        path: "Leif/concursos/trt/materias/b/assuntos/topico/assunto.md",
        content: doc("assunto", "topic-b", "Tópico")
      }
    ]);

    expect(() => ambiguous.resolveWikiLink("Leif/concursos/trt/concurso.md", "assunto")).toThrow(
      /ambiguous/i
    );
  });
});
