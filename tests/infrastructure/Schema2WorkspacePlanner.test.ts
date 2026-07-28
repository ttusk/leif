import { describe, expect, it } from "vitest";

import { Contest } from "@/domain/entities/Contest";
import { CycleState } from "@/domain/entities/CycleState";
import { Mural } from "@/domain/entities/Mural";
import { Resource } from "@/domain/entities/Resource";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { Subject } from "@/domain/entities/Subject";
import { Topic } from "@/domain/entities/Topic";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import {
  type Schema2FileChange,
  Schema2WorkspacePlanner,
  fingerprintSchema2Source
} from "@/infrastructure/markdown/schema2/Schema2WorkspacePlanner";

function data(): LeifPluginData {
  const record = new StudyRecord(
    "record-1",
    "contest-1",
    "2026-07-27",
    "subject-1",
    "resource-1",
    "topic-1",
    20,
    "paginas",
    undefined,
    true
  );
  return {
    schemaVersion: 4,
    activeContestId: "contest-1",
    contests: [new Contest("contest-1", "TRT Brasil", ["subject-1"], new Mural("Notas do mural."))],
    cycleStates: [new CycleState("contest-1", "subject-1", "resource-1")],
    subjects: [
      new Subject(
        "subject-1",
        "contest-1",
        "Português",
        1,
        true,
        60,
        "Teoria",
        ["resource-1"],
        ["topic-1"]
      )
    ],
    topics: [new Topic("topic-1", "subject-1", "Concordância Verbal")],
    resources: [
      new Resource(
        "resource-1",
        "subject-1",
        "PDF 01",
        1,
        "pdf",
        new ResourceGoal(80, "paginas"),
        false,
        ["topic-1"]
      )
    ],
    studyRecords: [record]
  };
}

describe("Schema2WorkspacePlanner", () => {
  it("plans deterministic creates with readable paths and relative wikilinks", () => {
    const plan = Schema2WorkspacePlanner.plan(data(), []);

    expect(plan.diagnostics).toEqual([]);
    expect(plan.changes.map((change) => `${change.kind}:${change.path}`)).toEqual([
      "create:Leif/concursos/trt-brasil/concurso.md",
      "create:Leif/concursos/trt-brasil/mural.md",
      "create:Leif/concursos/trt-brasil/materias/portugues/materia.md",
      "create:Leif/concursos/trt-brasil/materias/portugues/assuntos/concordancia-verbal/assunto.md",
      "create:Leif/concursos/trt-brasil/materias/portugues/recursos/pdf-01/recurso.md",
      "create:Leif/concursos/trt-brasil/registros/2026-07.md"
    ]);
    expect(contentFor(plan.changes, "concurso.md")).toContain(
      "[[materias/portugues/materia|Português]]"
    );
    expect(contentFor(plan.changes, "concurso.md")).toContain(
      'materia-atual: "[[materias/portugues/materia]]"'
    );
    expect(contentFor(plan.changes, "concurso.md")).toContain(
      'recurso-atual: "[[materias/portugues/recursos/pdf-01/recurso]]"'
    );
    expect(contentFor(plan.changes, "recurso.md")).toContain(
      "[[../../assuntos/concordancia-verbal/assunto|Concordância Verbal]]"
    );
    expect(contentFor(plan.changes, "registros/2026-07.md")).toContain(
      "recurso:: [[../materias/portugues/recursos/pdf-01/recurso]]"
    );
    expect(contentFor(plan.changes, "registros/2026-07.md")).not.toContain("atividade::");
  });

  it("keeps multiline record notes on one parseable property line", () => {
    const source = data();
    source.studyRecords[0] = new StudyRecord(
      "record-1",
      "contest-1",
      "2026-07-27",
      "subject-1",
      "resource-1",
      "topic-1",
      20,
      "paginas",
      undefined,
      true,
      "Fase: Teoria\nReferência: Aula 1"
    );

    const plan = Schema2WorkspacePlanner.plan(source, []);
    const month = contentFor(plan.changes, "registros/2026-07.md");

    expect(month).toContain('notas:: "Fase: Teoria\\nReferência: Aula 1"');
    expect(month).not.toContain("notas:: Fase: Teoria\nReferência:");
  });

  it("persists all records from the same contest month in one monthly document", () => {
    const source = data();
    source.studyRecords.push(
      new StudyRecord(
        "record-2",
        "contest-1",
        "2026-07-28",
        "subject-1",
        "resource-1",
        "topic-1",
        15,
        "paginas"
      )
    );

    const plan = Schema2WorkspacePlanner.plan(source, []);
    const studyPaths = plan.changes
      .map((change) => change.path)
      .filter((path) => path.includes("/registros/") || path.includes("/sessoes/"));

    expect(studyPaths).toEqual(["Leif/concursos/trt-brasil/registros/2026-07.md"]);
    expect(studyPaths.every((path) => !path.includes("/sessoes/"))).toBe(true);

    const month = contentFor(plan.changes, "registros/2026-07.md");
    expect(month).toContain("record-1");
    expect(month).toContain("record-2");
    expect(month).toContain("2026-07-27");
    expect(month).toContain("2026-07-28");
  });

  it("plans updates with source fingerprints and preserves unmanaged Markdown", () => {
    const currentResource = `---
leif-type: recurso
leif-schema: 2
leif-id: resource-1
formato: pdf
meta: 80
unidade: paginas
concluido: false
custom-key: keep
---

# PDF 01

Notas do usuário.

## Assuntos

<!-- leif:assuntos:start -->
<!-- leif:assuntos:end -->

## Acessos

<!-- leif:acessos:start -->
<!-- leif:acessos:end -->
`;
    const next = data();
    next.resources = [
      new Resource(
        "resource-1",
        "subject-1",
        "PDF atualizado",
        1,
        "pdf",
        new ResourceGoal(120, "paginas"),
        false,
        ["topic-1"]
      )
    ];

    const plan = Schema2WorkspacePlanner.plan(next, [
      {
        path: "Leif/concursos/trt-brasil/materias/portugues/recursos/pdf-01/recurso.md",
        content: currentResource
      }
    ]);
    const update = plan.changes.find((change) => change.path.endsWith("recurso.md"));

    expect(update).toMatchObject({
      kind: "update",
      expectedSourceFingerprint: fingerprintSchema2Source(currentResource)
    });
    expect(update && "content" in update ? update.content : "").toContain("# PDF atualizado");
    expect(update && "content" in update ? update.content : "").toContain("custom-key: keep");
    expect(update && "content" in update ? update.content : "").toContain("Notas do usuário.");
  });

  it("plans deletes for obsolete schema-2 entity documents", () => {
    const obsolete = `---
leif-type: assunto
leif-schema: 2
leif-id: topic-old
---

# Antigo
`;
    const plan = Schema2WorkspacePlanner.plan(data(), [
      {
        path: "Leif/concursos/trt-brasil/materias/portugues/assuntos/antigo/assunto.md",
        content: obsolete
      }
    ]);

    expect(plan.changes).toContainEqual({
      kind: "delete",
      path: "Leif/concursos/trt-brasil/materias/portugues/assuntos/antigo/assunto.md",
      expectedSourceFingerprint: fingerprintSchema2Source(obsolete)
    });
  });
});

function contentFor(changes: readonly Schema2FileChange[], suffix: string): string {
  const change = changes.find((change) => change.path.endsWith(suffix));
  return change && "content" in change ? change.content : "";
}
