import { describe, expect, it } from "vitest";

import { GoalUnit } from "@/domain/types/GoalUnit";
import { Schema1MarkdownProjector } from "@/infrastructure/markdown/schema1/Schema1MarkdownProjector";

function doc(type: string, id: string, title: string, extra = ""): string {
  return `---
leif-type: ${type}
leif-schema: 1
leif-id: ${id}
${extra}---

# ${title}
`;
}

describe("Schema1MarkdownProjector", () => {
  it("projects core schema-1 concurso, materia and item documents into the schema-3 domain", () => {
    const projected = Schema1MarkdownProjector.project([
      {
        path: "Leif/concursos/trt/concurso.md",
        content: `${doc(
          "concurso",
          "contest-1",
          "TRT",
          "exam-date: 2026-09-14\nboard: FCC\nweekly-study-hours: 20\n"
        )}## Matérias

<!-- leif:subjects:start -->
1. [[materias/portugues-abc123|Português]] ^leif-ref-7375626a6563742d31
<!-- leif:subjects:end -->
`
      },
      {
        path: "Leif/concursos/trt/materias/portugues-abc123.md",
        content: `${doc(
          "materia",
          "subject-1",
          "Português",
          "active: true\nplanned-minutes: 60\nstage: Teoria\n"
        )}## Itens

<!-- leif:items:start -->
1. [[../itens/pdf-01-def456|PDF 01]] ^leif-ref-7265736f757263652d31
<!-- leif:items:end -->

## Assuntos

<!-- leif:topics:start -->
1. [[../assuntos/concordancia|Concordância]] ^leif-ref-746f7069632d31
<!-- leif:topics:end -->
`
      },
      {
        path: "Leif/concursos/trt/itens/pdf-01-def456.md",
        content: `${doc("item", "resource-1", "PDF 01", "subject-id: subject-1\ntotal-pages: 80\n")}## Recursos

<!-- leif:resources:start -->
1. [[../recursos/arquivo-pdf|Arquivo PDF]] ^leif-ref-6163636573732d31
<!-- leif:resources:end -->
`
      },
      {
        path: "Leif/concursos/trt/recursos/arquivo-pdf.md",
        content: doc(
          "recurso",
          "access-1",
          "Arquivo PDF",
          "owner-type: item\nowner-id: resource-1\ntitle: Arquivo PDF\nresource-type: pdf\nurl: vault://pdf-01\nnotes: Baixado\n"
        )
      },
      {
        path: "Leif/concursos/trt/assuntos/concordancia.md",
        content: `${doc(
          "assunto",
          "topic-1",
          "Concordância",
          [
            "subject-id: subject-1",
            "notebook-id: notebook-1",
            "notebook-name: Caderno de Questões",
            "notebook-url: https://example.com/caderno",
            "notebook-solved: 120",
            "notebook-correct: 96",
            "notebook-notes: Importado do Tec"
          ].join("\n") + "\n"
        )}## Recursos

<!-- leif:resources:start -->
1. [[../recursos/aula-concordancia|Aula Concordância]] ^leif-ref-746f7069632d7265736f757263652d31
<!-- leif:resources:end -->
`
      },
      {
        path: "Leif/concursos/trt/recursos/aula-concordancia.md",
        content: doc(
          "recurso",
          "topic-resource-1",
          "Aula Concordância",
          "owner-type: assunto\nowner-id: topic-1\ntitle: Aula Concordância\nresource-type: video\nurl: https://example.com/aula\n"
        )
      }
    ]);

    expect(projected.contests).toMatchObject([
      {
        id: "contest-1",
        name: "TRT",
        subjectIds: ["subject-1"],
        examPlan: {
          examDate: "2026-09-14",
          board: "FCC",
          weeklyStudyHours: 20
        }
      }
    ]);
    expect(projected.subjects).toMatchObject([
      {
        id: "subject-1",
        contestId: "contest-1",
        name: "Português",
        order: 1,
        plannedStudyMinutes: 60,
        currentStage: "Teoria",
        resourceIds: ["resource-1", "topic-resource-1", "notebook-1"],
        topicIds: ["topic-1"]
      }
    ]);
    expect(projected.resources).toMatchObject([
      {
        id: "resource-1",
        subjectId: "subject-1",
        title: "PDF 01",
        order: 1,
        format: "pdf",
        goal: { amount: 80, unit: "paginas" },
        accesses: [{ title: "Arquivo PDF", url: "vault://pdf-01", notes: "Baixado" }]
      },
      {
        id: "topic-resource-1",
        subjectId: "subject-1",
        title: "Aula Concordância",
        order: 2,
        format: "video",
        topicIds: ["topic-1"],
        accesses: [{ title: "Aula Concordância", url: "https://example.com/aula" }]
      },
      {
        id: "notebook-1",
        subjectId: "subject-1",
        title: "Caderno de Questões",
        order: 3,
        format: "questoes",
        topicIds: ["topic-1"],
        accesses: [
          {
            title: "Caderno de Questões",
            url: "https://example.com/caderno",
            notes: "Importado do Tec"
          }
        ],
        baseline: { quantity: 120, correctAnswers: 96 }
      }
    ]);
  });

  it("projects schema-1 study records into one-record study sessions", () => {
    const projected = Schema1MarkdownProjector.project(
      [
        {
          path: "Leif/concursos/trt/concurso.md",
          content: doc("concurso", "contest-1", "TRT")
        },
        {
          path: "Leif/concursos/trt/registros/2026-07/2026-07-27-record-1.md",
          content: doc(
            "registro",
            "record-1",
            "Registro",
            [
              "contest-id: contest-1",
              "type: questions",
              "studied-at: 2026-07-27T19:30:00.000Z",
              "subject-id: subject-1",
              "item-id: resource-1",
              "topic-id: topic-1",
              "phase: Teoria",
              "reference: Bateria 01",
              "count: 30",
              "correct: 24",
              "completed: true"
            ].join("\n") + "\n"
          )
        },
        {
          path: "Leif/concursos/trt/registros/2026-07/2026-07-27-orphan.md",
          content: doc(
            "registro",
            "orphan-record",
            "Registro órfão",
            "contest-id: contest-1\ntype: pdf\nstudied-at: 2026-07-27T20:00:00.000Z\n"
          )
        }
      ],
      { sessionIdForRecord: (recordId) => `session-${recordId}` }
    );

    expect(projected.studySessions).toMatchObject([
      {
        id: "session-record-1",
        contestId: "contest-1",
        date: "2026-07-27",
        records: [
          {
            id: "record-1",
            subjectId: "subject-1",
            activity: "questoes",
            resourceId: "resource-1",
            topicId: "topic-1",
            quantity: 30,
            unit: GoalUnit.QUESTOES,
            correctAnswers: 24,
            completed: true,
            notes: "Fase: Teoria\nReferência: Bateria 01"
          }
        ]
      }
    ]);
  });

  it("projects schema-1 wall notes, links and snapshots into the mural", () => {
    const projected = Schema1MarkdownProjector.project([
      {
        path: "Leif/concursos/trt/concurso.md",
        content: `${doc("concurso", "contest-1", "TRT")}## Mural

<!-- leif:wall-notes:start -->
Edital publicado.
<!-- leif:wall-notes:end -->
`
      },
      {
        path: "Leif/concursos/trt/mural/notice-edital.md",
        content: doc(
          "mural-link",
          "link-1",
          "Edital",
          "contest-id: contest-1\nkind: notice\nlabel: Edital\nurl: https://example.com/edital\n"
        )
      },
      {
        path: "Leif/concursos/trt/mural/exam-prova.md",
        content: doc(
          "mural-link",
          "link-2",
          "Prova",
          "contest-id: contest-1\nkind: exam\nlabel: Página da prova\nurl: https://example.com/prova\n"
        )
      },
      {
        path: "Leif/concursos/trt/mural/snapshot-subject-1.md",
        content: `${doc(
          "mural-snapshot",
          "snapshot-1",
          "Snapshot",
          "contest-id: contest-1\nsubject-id: subject-1\nweight: 2\nscore: 80\n"
        )}## Itens alvo

<!-- leif:target-items:start -->
1. resource-1 ^leif-ref-7265736f757263652d31
<!-- leif:target-items:end -->
`
      }
    ]);

    expect(projected.contests[0].mural.notes).toBe(
      [
        "Edital publicado.",
        "[Edital](https://example.com/edital)",
        "[Página da prova](https://example.com/prova)"
      ].join("\n")
    );
    expect(projected.contests[0].mural.snapshots).toMatchObject([
      {
        subjectId: "subject-1",
        weight: 2,
        score: 80,
        targetResources: ["resource-1"]
      }
    ]);
  });

  it("keeps a schema-1 item format but omits a zero-valued goal", () => {
    const projected = Schema1MarkdownProjector.project([
      {
        path: "Leif/concursos/trt/itens/pdf-sem-total.md",
        content: doc(
          "item",
          "resource-1",
          "PDF sem total informado",
          "subject-id: subject-1\ntotal-pages: 0\n"
        )
      }
    ]);

    expect(projected.resources[0]).toMatchObject({
      id: "resource-1",
      format: "pdf",
      goal: undefined
    });
  });
});
