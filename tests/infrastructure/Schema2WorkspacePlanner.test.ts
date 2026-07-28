import { describe, expect, it } from "vitest";

import { Contest } from "@/domain/entities/Contest";
import { CycleState } from "@/domain/entities/CycleState";
import { Mural } from "@/domain/entities/Mural";
import { Resource } from "@/domain/entities/Resource";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { StudySession } from "@/domain/entities/StudySession";
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
    "subject-1",
    "leitura",
    "resource-1",
    "topic-1",
    20,
    "paginas",
    undefined,
    true
  );
  return {
    schemaVersion: 3,
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
    studySessions: [
      new StudySession("session-1", "contest-1", "2026-07-27", [record], "19:00", "20:00")
    ]
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
      "create:Leif/concursos/trt-brasil/sessoes/2026-07/2026-07-27-19-00/sessao.md",
      "create:Leif/concursos/trt-brasil/sessoes/2026-07/2026-07-27-19-00/registros/leitura.md"
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
    expect(contentFor(plan.changes, "leitura.md")).toContain(
      'recurso: "[[../../../../materias/portugues/recursos/pdf-01/recurso]]"'
    );
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
