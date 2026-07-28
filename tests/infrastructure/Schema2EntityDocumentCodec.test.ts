import { describe, expect, it } from "vitest";

import { Contest } from "@/domain/entities/Contest";
import { ImportedProgress } from "@/domain/entities/ImportedProgress";
import { Mural } from "@/domain/entities/Mural";
import { Resource } from "@/domain/entities/Resource";
import { ResourceAccess } from "@/domain/entities/ResourceAccess";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { StudySession } from "@/domain/entities/StudySession";
import { Subject } from "@/domain/entities/Subject";
import { Topic } from "@/domain/entities/Topic";
import { Schema2Document } from "@/infrastructure/markdown/schema2/Schema2Document";
import { Schema2EntityDocumentCodec } from "@/infrastructure/markdown/schema2/Schema2EntityDocumentCodec";

describe("Schema2EntityDocumentCodec", () => {
  it("renders readable schema-2 documents for every domain entity type", () => {
    const contest = new Contest("contest-1", "TRT", ["subject-1"], new Mural(), {
      examDate: "2026-09-14",
      board: "FCC",
      weeklyStudyHours: 20,
      weeklyQuestionGoal: 500
    });
    const subject = new Subject("subject-1", "contest-1", "Português", 1, true, 60, "Teoria", [
      "resource-1"
    ]);
    const topic = new Topic("topic-1", "subject-1", "Concordância");
    const resource = new Resource(
      "resource-1",
      "subject-1",
      "PDF 01",
      1,
      "pdf",
      new ResourceGoal(80, "paginas"),
      false,
      ["topic-1"],
      [new ResourceAccess("PDF principal", "https://example.com/pdf")],
      new ImportedProgress(30, 24)
    );
    const record = new StudyRecord(
      "record-1",
      "subject-1",
      "leitura",
      "resource-1",
      "topic-1",
      20,
      "paginas",
      undefined,
      true
    );
    const session = new StudySession(
      "session-1",
      "contest-1",
      "2026-07-27",
      [record],
      "19:00",
      "20:00"
    );

    expect(
      Schema2EntityDocumentCodec.renderContest(contest, {
        subjectLinks: [{ target: "materias/portugues/materia", alias: "Português" }],
        currentSubjectLink: "materias/portugues/materia",
        currentResourceLink: "materias/portugues/recursos/pdf-01/recurso"
      })
    ).toContain(
      'data-prova: 2026-09-14\nbanca: FCC\nhoras-semanais: 20\nmeta-questoes-semanal: 500\nmateria-atual: "[[materias/portugues/materia]]"\nrecurso-atual: "[[materias/portugues/recursos/pdf-01/recurso]]"\n'
    );
    expect(
      Schema2EntityDocumentCodec.renderSubject(subject, {
        topicLinks: [{ target: "assuntos/concordancia/assunto", alias: "Concordância" }],
        resourceLinks: [{ target: "recursos/pdf-01/recurso", alias: "PDF 01" }]
      })
    ).toContain("<!-- leif:recursos:start -->\n1. [[recursos/pdf-01/recurso|PDF 01]]");
    expect(Schema2EntityDocumentCodec.renderTopic(topic)).toBe(`---
leif-type: assunto
leif-schema: 2
leif-id: topic-1
---

# Concordância
`);
    expect(
      Schema2EntityDocumentCodec.renderResource(resource, {
        topicLinks: [{ target: "../../assuntos/concordancia/assunto", alias: "Concordância" }]
      })
    ).toContain("- [PDF principal](https://example.com/pdf)");
    expect(
      Schema2EntityDocumentCodec.renderResource(resource, {
        topicLinks: [{ target: "../../assuntos/concordancia/assunto", alias: "Concordância" }]
      })
    ).toContain("progresso-importado: 30\nacertos-importados: 24");
    expect(
      Schema2EntityDocumentCodec.renderSession(session, {
        recordLinks: [{ target: "registros/leitura-pdf-01", alias: "Leitura PDF 01" }]
      })
    ).toContain('inicio: "19:00"\nfim: "20:00"');
    expect(
      Schema2EntityDocumentCodec.renderRecord(record, {
        subjectLink: "../../../materias/portugues/materia",
        resourceLink: "../../../materias/portugues/recursos/pdf-01/recurso",
        topicLink: "../../../materias/portugues/assuntos/concordancia/assunto"
      })
    ).toContain('materia: "[[../../../materias/portugues/materia]]"');
    expect(Schema2EntityDocumentCodec.renderMural("mural-1", new Mural("Notas livres."))).toContain(
      "# Mural\n\nNotas livres.\n"
    );
  });

  it("updates managed resource fields while preserving unknown frontmatter and user prose", () => {
    const existing = Schema2Document.parse(`---
leif-type: recurso
leif-schema: 2
leif-id: resource-1
formato: pdf
meta: 80
unidade: paginas
concluido: false
custom-key: preserve-me
---

# PDF 01

Notas livres do usuário.

## Assuntos

<!-- leif:assuntos:start -->
- [[../../assuntos/antigo/assunto|Antigo]]
<!-- leif:assuntos:end -->

## Acessos

<!-- leif:acessos:start -->
- [Antigo](https://example.com/old)
<!-- leif:acessos:end -->
`);
    const updated = Schema2EntityDocumentCodec.updateResource(
      existing,
      new Resource(
        "resource-1",
        "subject-1",
        "PDF atualizado",
        1,
        "livro",
        new ResourceGoal(120, "paginas"),
        true,
        ["topic-1"],
        [new ResourceAccess("Novo", "vault://novo.pdf")],
        new ImportedProgress(50, 40)
      ),
      { topicLinks: [{ target: "../../assuntos/novo/assunto", alias: "Novo" }] }
    ).toString();

    expect(updated).toContain("custom-key: preserve-me");
    expect(updated).toContain("# PDF atualizado");
    expect(updated).toContain("Notas livres do usuário.");
    expect(updated).toContain("formato: livro");
    expect(updated).toContain("meta: 120");
    expect(updated).toContain("concluido: true");
    expect(updated).toContain("progresso-importado: 50");
    expect(updated).toContain("acertos-importados: 40");
    expect(updated).toContain("- [[../../assuntos/novo/assunto|Novo]]");
    expect(updated).toContain("- [Novo](vault://novo.pdf)");
  });
});
