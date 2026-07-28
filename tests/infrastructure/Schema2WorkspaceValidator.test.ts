import { describe, expect, it } from "vitest";

import {
  Schema2WorkspaceValidator,
  renderSchema2DiagnosticsMarkdown
} from "@/infrastructure/markdown/schema2/Schema2WorkspaceValidator";

function doc(type: string, id: string, title: string, extra = ""): string {
  return `---
leif-type: ${type}
leif-schema: 2
leif-id: ${id}
${extra}---

# ${title}
`;
}

const validWorkspace = [
  {
    path: "Leif/concursos/trt/concurso.md",
    content: `${doc("concurso", "contest-1", "TRT")}## Ordem do ciclo

<!-- leif:materias:start -->
1. [[materias/portugues/materia|Português]]
<!-- leif:materias:end -->
`
  },
  {
    path: "Leif/concursos/trt/materias/portugues/materia.md",
    content: `${doc("materia", "subject-1", "Português")}## Assuntos

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
    content: `${doc("recurso", "resource-1", "PDF 01")}## Assuntos

<!-- leif:assuntos:start -->
- [[../../assuntos/concordancia/assunto|Concordância]]
<!-- leif:assuntos:end -->
`
  },
  {
    path: "Leif/concursos/trt/sessoes/2026-07/2026-07-27/sessao.md",
    content: `${doc("sessao", "session-1", "Sessão", "data: 2026-07-27\n")}## Registros

<!-- leif:registros:start -->
1. [[registros/leitura|Leitura]]
<!-- leif:registros:end -->
`
  },
  {
    path: "Leif/concursos/trt/sessoes/2026-07/2026-07-27/registros/leitura.md",
    content: doc(
      "registro",
      "record-1",
      "Leitura",
      'materia: "[[../../../materias/portugues/materia]]"\natividade: leitura\n'
    )
  }
];

describe("Schema2WorkspaceValidator", () => {
  it("returns no diagnostics for a coherent schema-2 workspace", () => {
    expect(Schema2WorkspaceValidator.validate(validWorkspace)).toEqual([]);
  });

  it("reports parse and index diagnostics without mutating source content", () => {
    const diagnostics = Schema2WorkspaceValidator.validate([
      {
        path: "Leif/concursos/futuro/concurso.md",
        content: doc("concurso", "contest-future", "Futuro").replace(
          "leif-schema: 2",
          "leif-schema: 99"
        )
      },
      validWorkspace[0],
      { path: "Leif/concursos/outro/concurso.md", content: doc("concurso", "contest-1", "Outro") }
    ]);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SCHEMA2_FUTURE_SCHEMA",
          severity: "erro",
          path: "Leif/concursos/futuro/concurso.md"
        }),
        expect.objectContaining({
          code: "SCHEMA2_DUPLICATE_ID",
          severity: "erro"
        })
      ])
    );
  });

  it("reports broken wikilinks and cross-subject relationships", () => {
    const brokenLink = Schema2WorkspaceValidator.validate([
      ...validWorkspace.slice(0, 3),
      {
        path: "Leif/concursos/trt/materias/portugues/recursos/pdf-01/recurso.md",
        content: `${doc("recurso", "resource-1", "PDF 01")}## Assuntos

<!-- leif:assuntos:start -->
- [[../../assuntos/inexistente/assunto|Inexistente]]
<!-- leif:assuntos:end -->
`
      }
    ]);
    expect(brokenLink).toEqual([
      expect.objectContaining({
        code: "SCHEMA2_BROKEN_WIKILINK",
        severity: "erro"
      })
    ]);

    const crossSubject = Schema2WorkspaceValidator.validate([
      validWorkspace[0],
      validWorkspace[1],
      validWorkspace[2],
      {
        path: "Leif/concursos/trt/materias/direito/materia.md",
        content: `${doc("materia", "subject-2", "Direito")}## Assuntos

<!-- leif:assuntos:start -->
1. [[assuntos/lei/assunto|Lei]]
<!-- leif:assuntos:end -->

## Recursos

<!-- leif:recursos:start -->
<!-- leif:recursos:end -->
`
      },
      {
        path: "Leif/concursos/trt/materias/direito/assuntos/lei/assunto.md",
        content: doc("assunto", "topic-2", "Lei")
      },
      {
        path: "Leif/concursos/trt/materias/portugues/recursos/pdf-01/recurso.md",
        content: `${doc("recurso", "resource-1", "PDF 01")}## Assuntos

<!-- leif:assuntos:start -->
- [[../../../direito/assuntos/lei/assunto|Lei]]
<!-- leif:assuntos:end -->
`
      }
    ]);
    expect(crossSubject).toEqual([
      expect.objectContaining({
        code: "SCHEMA2_CROSS_SUBJECT_LINK",
        severity: "erro"
      })
    ]);
  });

  it("renders diagnosticos.md in Portuguese", () => {
    expect(renderSchema2DiagnosticsMarkdown([], "2026-07-27T13:00:00.000Z")).toContain(
      "Resultado: sem problemas"
    );
    expect(
      renderSchema2DiagnosticsMarkdown(
        [
          {
            code: "SCHEMA2_BROKEN_WIKILINK",
            severity: "erro",
            path: "Leif/concursos/trt/concurso.md",
            message: "Link não encontrado.",
            guidance: "Atualize o wikilink para um documento existente."
          }
        ],
        "2026-07-27T13:00:00.000Z"
      )
    ).toContain("| SCHEMA2_BROKEN_WIKILINK | erro | Leif/concursos/trt/concurso.md |");
  });
});
