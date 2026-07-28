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
    path: "Leif/concursos/trt/sessoes/2026-07/2026-07-27/sessao.md",
    content: `${doc(
      "sessao",
      "session-1",
      "Sessão 2026-07-27",
      'data: 2026-07-27\ninicio: "19:00"\nfim: "20:00"\n'
    )}## Registros

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
      'materia: "[[../../../materias/portugues/materia]]"\nrecurso: "[[../../../materias/portugues/recursos/pdf-01/recurso]]"\natividade: questoes\nquantidade: 30\nunidade: questoes\nacertos: 24\nconcluido: true\n'
    )
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
    expect(decoded.studySessions[0]).toMatchObject({
      id: "session-1",
      contestId: "contest-1",
      date: "2026-07-27",
      startTime: "19:00",
      endTime: "20:00",
      records: [
        {
          id: "record-1",
          subjectId: "subject-1",
          activity: "questoes",
          resourceId: "resource-1",
          quantity: 30,
          unit: "questoes",
          correctAnswers: 24,
          completed: true
        }
      ]
    });
    expect(decoded.cycleStates).toMatchObject([
      {
        contestId: "contest-1",
        currentSubjectId: "subject-1",
        currentResourceId: "resource-1"
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
