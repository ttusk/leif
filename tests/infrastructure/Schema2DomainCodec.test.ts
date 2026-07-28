import { describe, expect, it } from "vitest";

import {
  Schema2DomainCodec,
  Schema2DomainCodecError
} from "@/infrastructure/markdown/schema2/Schema2DomainCodec";
import { Schema2WorkspaceIndex } from "@/infrastructure/markdown/schema2/Schema2WorkspaceIndex";

function doc(type: string, id: string, title: string, extra = ""): string {
  return `---
leif-type: ${type}
leif-schema: 2
leif-id: ${id}
${extra}---

# ${title}
`;
}

const workspace = [
  {
    path: "Leif/concursos/trt/concurso.md",
    content: `${doc(
      "concurso",
      "contest-1",
      "TRT",
      'data-prova: 2026-09-14\nbanca: FCC\nhoras-semanais: 20\nmeta-questoes-semanal: 500\nmateria-atual: "[[materias/portugues/materia]]"\nrecurso-atual: "[[materias/portugues/recursos/pdf-01/recurso]]"\n'
    )}## Ordem do ciclo

<!-- leif:materias:start -->
1. [[materias/portugues/materia|Português]]
<!-- leif:materias:end -->
`
  },
  {
    path: "Leif/concursos/trt/materias/portugues/materia.md",
    content: `${doc(
      "materia",
      "subject-1",
      "Português",
      "ativa: true\nminutos-planejados: 60\netapa: Teoria\n"
    )}## Assuntos

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
    content: `${doc(
      "recurso",
      "resource-1",
      "PDF 01",
      "formato: pdf\nmeta: 80\nunidade: paginas\nconcluido: false\nprogresso-importado: 30\nacertos-importados: 24\n"
    )}## Assuntos

<!-- leif:assuntos:start -->
- [[../../assuntos/concordancia/assunto|Concordância]]
<!-- leif:assuntos:end -->

## Acessos

<!-- leif:acessos:start -->
- [PDF principal](https://example.com/pdf)
<!-- leif:acessos:end -->
`
  },
  {
    path: "Leif/concursos/trt/registros/2026-07.md",
    content: `${doc("registros", "registros-contest-1-2026-07", "Registros — 2026-07", "mes: 2026-07\n")}

<!-- leif:registros:start -->
## 2026-07-27 · Português

leif-id:: record-1
data:: 2026-07-27
materia:: [[../materias/portugues/materia]]
recurso:: [[../materias/portugues/recursos/pdf-01/recurso]]
quantidade:: 30
unidade:: questoes
acertos:: 24
concluido:: true
notas:: "Revisão\\nfinal"
<!-- leif:registros:end -->
`
  },
  {
    path: "Leif/concursos/trt/mural.md",
    content: `${doc("mural", "mural-1", "Mural")}Notas livres do mural.
`
  }
];

describe("Schema2DomainCodec", () => {
  it("decodes schema-2 entity documents into the schema-3 domain model", () => {
    const decoded = Schema2DomainCodec.decode(Schema2WorkspaceIndex.build(workspace));

    expect(decoded.contests[0]).toMatchObject({
      id: "contest-1",
      name: "TRT",
      subjectIds: ["subject-1"],
      examPlan: {
        examDate: "2026-09-14",
        board: "FCC",
        weeklyStudyHours: 20,
        weeklyQuestionGoal: 500
      },
      mural: {
        notes: "Notas livres do mural."
      }
    });
    expect(decoded.subjects[0]).toMatchObject({
      id: "subject-1",
      contestId: "contest-1",
      name: "Português",
      order: 1,
      isActive: true,
      plannedStudyMinutes: 60,
      currentStage: "Teoria",
      resourceIds: ["resource-1"],
      topicIds: ["topic-1"]
    });
    expect(decoded.topics[0]).toMatchObject({
      id: "topic-1",
      subjectId: "subject-1",
      name: "Concordância"
    });
    expect(decoded.resources[0]).toMatchObject({
      id: "resource-1",
      subjectId: "subject-1",
      title: "PDF 01",
      order: 1,
      format: "pdf",
      goal: { amount: 80, unit: "paginas" },
      completed: false,
      topicIds: ["topic-1"],
      accesses: [{ title: "PDF principal", url: "https://example.com/pdf" }],
      baseline: { quantity: 30, correctAnswers: 24 }
    });
    expect(decoded.studyRecords[0]).toMatchObject({
      id: "record-1",
      contestId: "contest-1",
      date: "2026-07-27",
      subjectId: "subject-1",
      resourceId: "resource-1",
      quantity: 30,
      unit: "questoes",
      correctAnswers: 24,
      completed: true,
      notes: "Revisão\nfinal"
    });
    expect(decoded.cycleStates).toMatchObject([
      {
        contestId: "contest-1",
        currentSubjectId: "subject-1",
        currentResourceId: "resource-1"
      }
    ]);
  });

  it("accepts wikilink properties re-quoted by Obsidian during a staged move", () => {
    const rewritten = workspace.map((file) => ({
      ...file,
      content: file.content.replace(/^((?:materia|recurso):: )(\[\[.+\]\])$/gm, '$1"$2"')
    }));

    const decoded = Schema2DomainCodec.decode(Schema2WorkspaceIndex.build(rewritten));

    expect(decoded.studyRecords[0]).toMatchObject({
      subjectId: "subject-1",
      resourceId: "resource-1"
    });
  });

  it("flattens legacy session documents while reading an existing vault", () => {
    const legacy = [
      ...workspace.filter((file) => !file.path.includes("/registros/2026-07.md")),
      {
        path: "Leif/concursos/trt/sessoes/2026-07/2026-07-27/sessao.md",
        content: `${doc(
          "sessao",
          "session-1",
          "Sessão 2026-07-27",
          "data: 2026-07-27\n"
        )}## Registros

<!-- leif:registros:start -->
1. [[registros/leitura|Leitura]]
<!-- leif:registros:end -->
`
      },
      {
        path: "Leif/concursos/trt/sessoes/2026-07/2026-07-27/registros/leitura.md",
        content: doc(
          "registro",
          "legacy-record",
          "Leitura",
          'materia: "[[../../../materias/portugues/materia]]"\nquantidade: 10\nunidade: paginas\nconcluido: false\n'
        )
      }
    ];

    const decoded = Schema2DomainCodec.decode(Schema2WorkspaceIndex.build(legacy));

    expect(decoded.studyRecords).toMatchObject([
      {
        id: "legacy-record",
        contestId: "contest-1",
        date: "2026-07-27",
        subjectId: "subject-1"
      }
    ]);
  });

  it("rejects linked topics that do not belong to the resource subject", () => {
    const index = Schema2WorkspaceIndex.build([
      workspace[0],
      workspace[1],
      workspace[2],
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

    expect(() => Schema2DomainCodec.decode(index)).toThrow(Schema2DomainCodecError);
    expect(() => Schema2DomainCodec.decode(index)).toThrow(/must belong to the same subject/i);
  });
});
