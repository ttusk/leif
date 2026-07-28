import { describe, expect, it } from "vitest";

import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { Contest } from "@/domain/entities/Contest";
import { CycleState } from "@/domain/entities/CycleState";
import { Resource } from "@/domain/entities/Resource";
import { Subject } from "@/domain/entities/Subject";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { Schema2PluginDataStore } from "@/infrastructure/persistence/Schema2PluginDataStore";

class MemoryMarkdownFileStore implements MarkdownFileStore {
  readonly files = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    Object.entries(initial).forEach(([path, content]) => this.files.set(path, content));
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async writeNew(path: string, content: string): Promise<void> {
    if (this.files.has(path)) throw new Error(`Path exists: ${path}`);
    this.files.set(path, content);
  }

  async read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`Missing: ${path}`);
    return content;
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.files.keys()].filter((path) => path.startsWith(prefix)).sort();
  }

  async move(source: string, destination: string): Promise<void> {
    const content = this.files.get(source);
    if (content === undefined) throw new Error(`Missing source: ${source}`);
    if (this.files.has(destination)) throw new Error(`Destination exists: ${destination}`);
    this.files.delete(source);
    this.files.set(destination, content);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }
}

class MemoryStorageAdapter implements PersistentStorageAdapter<LeifPluginData> {
  saved: LeifPluginData | null;
  readonly saves: LeifPluginData[] = [];

  constructor(initial: LeifPluginData | null) {
    this.saved = initial;
  }

  async load(): Promise<LeifPluginData | null> {
    return this.saved;
  }

  async save(data: LeifPluginData): Promise<void> {
    this.saved = structuredClone(data);
    this.saves.push(structuredClone(data));
  }
}

function doc(type: string, id: string, title: string, extra = ""): string {
  return `---
leif-type: ${type}
leif-schema: 2
leif-id: ${id}
${extra}---

# ${title}
`;
}

const markdownFiles = {
  "Leif/concursos/trt/concurso.md": `${doc(
    "concurso",
    "contest-1",
    "TRT",
    'materia-atual: "[[materias/portugues/materia]]"\n'
  )}## Ordem do ciclo

<!-- leif:materias:start -->
1. [[materias/portugues/materia|Português]]
<!-- leif:materias:end -->
`,
  "Leif/concursos/trt/materias/portugues/materia.md": `${doc("materia", "subject-1", "Português")}## Assuntos

<!-- leif:assuntos:start -->
<!-- leif:assuntos:end -->

## Recursos

<!-- leif:recursos:start -->
<!-- leif:recursos:end -->
`,
  "Leif/concursos/trt/mural.md": `${doc("mural", "mural-contest-1", "Mural")}Notas.
`
};

describe("Schema2PluginDataStore", () => {
  it("loads study data from schema-2 Markdown and operational state from JSON", async () => {
    const operational: LeifPluginData = {
      ...createDefaultLeifPluginData(),
      activeContestId: "contest-1",
      cycleStates: [new CycleState("contest-1", "json-subject", "json-resource")],
      contests: [new Contest("json-contest", "JSON should not be authority")]
    };
    const store = new Schema2PluginDataStore(
      new MemoryStorageAdapter(operational),
      new MemoryMarkdownFileStore(markdownFiles),
      () => "tx-load"
    );

    const loaded = await store.load();

    expect(loaded.activeContestId).toBe("contest-1");
    expect(loaded.contests).toMatchObject([{ id: "contest-1", name: "TRT" }]);
    expect(loaded.subjects).toMatchObject([{ id: "subject-1", contestId: "contest-1" }]);
    expect(loaded.cycleStates).toMatchObject([
      { contestId: "contest-1", currentSubjectId: "subject-1", currentResourceId: null }
    ]);
    expect(loaded.contests.map((contest) => contest.id)).not.toContain("json-contest");
  });

  it("backs up and consolidates legacy session Markdown on startup", async () => {
    const legacySessionFiles = {
      ...markdownFiles,
      "Leif/concursos/trt/sessoes/2026-07/2026-07-28/sessao.md": `---
leif-type: sessao
leif-schema: 2
leif-id: session-1
data: 2026-07-28
---

# Sessão 2026-07-28

## Registros

<!-- leif:registros:start -->
1. [[registros/registro-1|Registro 1]]
<!-- leif:registros:end -->
`,
      "Leif/concursos/trt/sessoes/2026-07/2026-07-28/registros/registro-1.md": `---
leif-type: registro
leif-schema: 2
leif-id: legacy-record-1
materia: "[[../../../materias/portugues/materia]]"
quantidade: 25
unidade: paginas
concluido: true
---

# Registro
`
    };
    const storage = new MemoryStorageAdapter(createDefaultLeifPluginData());
    const markdown = new MemoryMarkdownFileStore(legacySessionFiles);
    const store = new Schema2PluginDataStore(storage, markdown, () => "tx-flatten");

    const first = await store.load();
    const second = await store.load();

    expect(first.studyRecords).toMatchObject([
      { id: "legacy-record-1", contestId: "contest-1", date: "2026-07-28" }
    ]);
    expect(second.studyRecords).toHaveLength(1);
    expect(markdown.files.get("Leif/concursos/trt/registros/2026-07.md")).toContain(
      "leif-id:: legacy-record-1"
    );
    expect([...markdown.files.keys()].some((path) => path.includes("/sessoes/"))).toBe(false);
    expect(markdown.files.get("Leif/.backups/migration-tx-flatten/manifest.json")).toContain(
      "legacy-record-1"
    );
    expect(storage.saved?.runtimeState?.migrationReceipts).toContainEqual(
      expect.objectContaining({
        id: "migration-tx-flatten",
        source: "markdown-schema-2-sessions",
        status: "migrated"
      })
    );
  });

  it("migrates legacy JSON study data into schema-2 Markdown on startup", async () => {
    const legacy = {
      ...createDefaultLeifPluginData(),
      schemaVersion: 3,
      activeContestId: "contest-1",
      contests: [new Contest("contest-1", "TRT", ["subject-1"])],
      cycleStates: [new CycleState("contest-1", "subject-1", "resource-1")],
      subjects: [
        new Subject("subject-1", "contest-1", "Português", 1, true, 0, undefined, ["resource-1"])
      ],
      resources: [new Resource("resource-1", "subject-1", "PDF 01", 1)],
      studySessions: [
        {
          id: "session-1",
          contestId: "contest-1",
          date: "2026-07-28",
          records: [
            {
              id: "record-1",
              subjectId: "subject-1",
              resourceId: "resource-1",
              quantity: 20,
              unit: "paginas",
              completed: true,
              notes: "Fase: Teoria\nReferência: Aula 1"
            }
          ]
        }
      ]
    } as never;
    const storage = new MemoryStorageAdapter(legacy);
    const markdown = new MemoryMarkdownFileStore();
    const store = new Schema2PluginDataStore(storage, markdown, () => "tx-migrate");

    const loaded = await store.load();

    expect(loaded.contests).toMatchObject([{ id: "contest-1", name: "TRT" }]);
    expect(loaded.cycleStates).toMatchObject([
      { contestId: "contest-1", currentSubjectId: "subject-1", currentResourceId: "resource-1" }
    ]);
    expect(loaded.studyRecords).toMatchObject([
      {
        id: "record-1",
        date: "2026-07-28",
        notes: "Fase: Teoria\nReferência: Aula 1"
      }
    ]);
    expect(markdown.files.get("Leif/concursos/trt/registros/2026-07.md")).toContain(
      "leif-id:: record-1"
    );
    expect(markdown.files.get("Leif/concursos/trt/concurso.md")).toContain("# TRT");
    expect(markdown.files.get("Leif/.backups/migration-tx-migrate/data.json")).toContain(
      '"contest-1"'
    );
    expect(storage.saved).toMatchObject({
      activeContestId: "contest-1",
      contests: [],
      cycleStates: [],
      subjects: [],
      resources: [],
      runtimeState: {
        migrationReceipts: [
          {
            id: "migration-tx-migrate",
            contestId: "contest-1",
            source: "legacy-json",
            status: "migrated",
            backupPath: "Leif/.backups/migration-tx-migrate/data.json",
            diagnostics: []
          }
        ]
      }
    });
    expect(storage.saves[0]).toMatchObject({
      runtimeState: {
        migrationReceipts: [
          {
            id: "migration-tx-migrate",
            contestId: "contest-1",
            source: "legacy-json",
            status: "started",
            backupPath: "Leif/.backups/migration-tx-migrate/data.json",
            diagnostics: []
          }
        ]
      }
    });
  });

  it("keeps an interrupted migration receipt read-only instead of starting another migration", async () => {
    const operational: LeifPluginData = {
      ...createDefaultLeifPluginData(),
      activeContestId: "contest-1",
      runtimeState: {
        ...createDefaultLeifPluginData().runtimeState!,
        migrationReceipts: [
          {
            id: "migration-tx-interrupted",
            contestId: "contest-1",
            source: "legacy-json",
            status: "started",
            backupPath: "Leif/.backups/migration-tx-interrupted/data.json",
            diagnostics: [],
            createdAt: "2026-07-27T12:00:00.000Z"
          }
        ]
      }
    };
    const storage = new MemoryStorageAdapter(operational);
    const markdown = new MemoryMarkdownFileStore();
    const store = new Schema2PluginDataStore(storage, markdown, () => "tx-new");

    const loaded = await store.load();

    expect(loaded.activeContestId).toBe("contest-1");
    expect(store.readOnlyContestIds()).toEqual(["contest-1"]);
    expect(store.diagnostics()).toEqual([
      expect.objectContaining({ code: "SCHEMA2_MIGRATION_INTERRUPTED" })
    ]);
    expect(markdown.files.has("Leif/concursos/trt/concurso.md")).toBe(false);
    expect(markdown.files.has("Leif/.backups/migration-tx-new/data.json")).toBe(false);
    expect(storage.saves).toEqual([]);

    await expect(
      store.mutate((data) => {
        data.contests.push(new Contest("contest-2", "Novo"));
      })
    ).rejects.toThrow(/read-only/i);
  });

  it("records a failed receipt and keeps legacy JSON projection read-only when migration fails", async () => {
    const legacy = {
      ...createDefaultLeifPluginData(),
      activeContestId: "contest-1",
      contests: [new Contest("contest-1", "TRT", ["subject-1"])],
      cycleStates: [new CycleState("contest-1", "subject-1", "missing-resource")],
      subjects: [new Subject("subject-1", "contest-1", "Português", 1)]
    };
    const storage = new MemoryStorageAdapter(legacy);
    const markdown = new MemoryMarkdownFileStore();
    const store = new Schema2PluginDataStore(storage, markdown, () => "tx-failed");

    const loaded = await store.load();

    expect(loaded.contests).toMatchObject([{ id: "contest-1", name: "TRT" }]);
    expect(store.readOnlyContestIds()).toEqual(["contest-1"]);
    expect(store.diagnostics()).toEqual([
      expect.objectContaining({ code: "SCHEMA2_LEGACY_JSON_MIGRATION_FAILED" })
    ]);
    expect(markdown.files.get("Leif/.backups/migration-tx-failed/data.json")).toContain(
      "missing-resource"
    );
    expect(markdown.files.has("Leif/concursos/trt/concurso.md")).toBe(false);
    expect(storage.saved).toMatchObject({
      activeContestId: "contest-1",
      contests: [],
      runtimeState: {
        migrationReceipts: [
          {
            id: "migration-tx-failed",
            contestId: "contest-1",
            source: "legacy-json",
            status: "failed",
            backupPath: "Leif/.backups/migration-tx-failed/data.json",
            diagnostics: [expect.objectContaining({ code: "SCHEMA2_LEGACY_JSON_MIGRATION_FAILED" })]
          }
        ]
      }
    });

    await expect(
      store.mutate((data) => {
        data.contests.push(new Contest("contest-2", "Novo"));
      })
    ).rejects.toThrow(/read-only/i);
  });

  it("migrates schema-1 Markdown bundles into schema-2 Markdown on startup", async () => {
    const schema1 = {
      "Leif/concursos/trt/concurso.md": `${doc(
        "concurso",
        "contest-1",
        "TRT",
        "exam-date: 2026-09-14\n"
      ).replace("leif-schema: 2", "leif-schema: 1")}## Matérias

<!-- leif:subjects:start -->
1. [[materias/portugues-abc123|Português]] ^leif-ref-7375626a6563742d31
<!-- leif:subjects:end -->

## Mural

<!-- leif:wall-notes:start -->
Edital publicado.
<!-- leif:wall-notes:end -->
`,
      "Leif/concursos/trt/materias/portugues-abc123.md": `${doc(
        "materia",
        "subject-1",
        "Português",
        "active: true\n"
      ).replace("leif-schema: 2", "leif-schema: 1")}## Itens

<!-- leif:items:start -->
1. [[../itens/pdf-01-def456|PDF 01]] ^leif-ref-7265736f757263652d31
<!-- leif:items:end -->

## Assuntos

<!-- leif:topics:start -->
1. [[../assuntos/concordancia|Concordância]] ^leif-ref-746f7069632d31
<!-- leif:topics:end -->
`,
      "Leif/concursos/trt/itens/pdf-01-def456.md": doc(
        "item",
        "resource-1",
        "PDF 01",
        "subject-id: subject-1\ntotal-pages: 80\n"
      )
        .replace("leif-schema: 2", "leif-schema: 1")
        .replace(
          "# PDF 01\n",
          `# PDF 01

## Recursos

<!-- leif:resources:start -->
1. [[../recursos/arquivo-pdf|Arquivo PDF]] ^leif-ref-6163636573732d31
<!-- leif:resources:end -->
`
        ),
      "Leif/concursos/trt/recursos/arquivo-pdf.md": doc(
        "recurso",
        "access-1",
        "Arquivo PDF",
        "owner-type: item\nowner-id: resource-1\ntitle: Arquivo PDF\nresource-type: pdf\nurl: vault://pdf-01\n"
      ).replace("leif-schema: 2", "leif-schema: 1"),
      "Leif/concursos/trt/assuntos/concordancia.md": doc(
        "assunto",
        "topic-1",
        "Concordância",
        [
          "subject-id: subject-1",
          "notebook-id: notebook-1",
          "notebook-name: Caderno de Questões",
          "notebook-url: https://example.com/caderno",
          "notebook-solved: 120",
          "notebook-correct: 96"
        ].join("\n") + "\n"
      )
        .replace("leif-schema: 2", "leif-schema: 1")
        .replace(
          "# Concordância\n",
          `# Concordância

## Recursos

<!-- leif:resources:start -->
1. [[../recursos/aula-concordancia|Aula Concordância]] ^leif-ref-746f7069632d7265736f757263652d31
<!-- leif:resources:end -->
`
        ),
      "Leif/concursos/trt/recursos/aula-concordancia.md": doc(
        "recurso",
        "topic-resource-1",
        "Aula Concordância",
        "owner-type: assunto\nowner-id: topic-1\ntitle: Aula Concordância\nresource-type: video\nurl: https://example.com/aula\n"
      ).replace("leif-schema: 2", "leif-schema: 1"),
      "Leif/concursos/trt/registros/2026-07/2026-07-27-record-1.md": doc(
        "registro",
        "record-1",
        "Registro",
        [
          "contest-id: contest-1",
          "type: questions",
          "studied-at: 2026-07-27T19:30:00.000Z",
          "subject-id: subject-1",
          "item-id: resource-1",
          "count: 30",
          "correct: 24",
          "completed: true"
        ].join("\n") + "\n"
      ).replace("leif-schema: 2", "leif-schema: 1"),
      "Leif/concursos/trt/mural/notice-edital.md": doc(
        "mural-link",
        "link-1",
        "Edital",
        "contest-id: contest-1\nkind: notice\nlabel: Edital\nurl: https://example.com/edital\n"
      ).replace("leif-schema: 2", "leif-schema: 1")
    };
    const storage = new MemoryStorageAdapter(createDefaultLeifPluginData());
    const markdown = new MemoryMarkdownFileStore(schema1);
    const store = new Schema2PluginDataStore(storage, markdown, () => "tx-schema1");

    const loaded = await store.load();

    expect(loaded.contests).toMatchObject([{ id: "contest-1", name: "TRT" }]);
    expect(loaded.resources.find((resource) => resource.id === "resource-1")).toMatchObject({
      goal: { amount: 80 },
      accesses: [{ title: "Arquivo PDF", url: "vault://pdf-01" }]
    });
    expect(loaded.resources.find((resource) => resource.id === "topic-resource-1")).toMatchObject({
      format: "video",
      topicIds: ["topic-1"],
      accesses: [{ title: "Aula Concordância", url: "https://example.com/aula" }]
    });
    expect(loaded.resources.find((resource) => resource.id === "notebook-1")).toMatchObject({
      format: "questoes",
      topicIds: ["topic-1"],
      accesses: [{ title: "Caderno de Questões", url: "https://example.com/caderno" }],
      baseline: { quantity: 120, correctAnswers: 96 }
    });
    expect(loaded.contests[0].mural.notes).toContain("Edital publicado.");
    expect(loaded.contests[0].mural.notes).toContain("[Edital](https://example.com/edital)");
    expect(loaded.studyRecords).toMatchObject([
      {
        id: "record-1",
        contestId: "contest-1",
        date: "2026-07-27",
        subjectId: "subject-1",
        resourceId: "resource-1",
        quantity: 30,
        unit: "questoes",
        correctAnswers: 24,
        completed: true
      }
    ]);
    expect(markdown.files.get("Leif/concursos/trt/concurso.md")).toContain("leif-schema: 2");
    expect(markdown.files.get("Leif/concursos/trt/concurso.md")).toContain(
      "[[materias/portugues/materia|Português]]"
    );
    expect(
      markdown.files.get("Leif/concursos/trt/materias/portugues/recursos/pdf-01/recurso.md")
    ).toContain("- [Arquivo PDF](vault://pdf-01)");
    expect(
      markdown.files.get(
        "Leif/concursos/trt/materias/portugues/recursos/aula-concordancia/recurso.md"
      )
    ).toContain("[[../../assuntos/concordancia/assunto|Concordância]]");
    expect(
      markdown.files.get(
        "Leif/concursos/trt/materias/portugues/recursos/caderno-de-questoes/recurso.md"
      )
    ).toContain("progresso-importado: 120\nacertos-importados: 96");
    expect(markdown.files.get("Leif/concursos/trt/mural.md")).toContain("Edital publicado.");
    expect(markdown.files.get("Leif/concursos/trt/mural.md")).toContain(
      "[Edital](https://example.com/edital)"
    );
    const migratedRecords = markdown.files.get("Leif/concursos/trt/registros/2026-07.md");
    expect(migratedRecords).toContain("leif-type: registros");
    expect(migratedRecords).not.toContain("atividade::");
    expect(migratedRecords).toContain("acertos:: 24");
    expect(markdown.files.get("Leif/.backups/migration-tx-schema1/manifest.json")).toContain(
      "portugues-abc123.md"
    );
    expect(storage.saved).toMatchObject({
      runtimeState: {
        migrationReceipts: [
          {
            id: "migration-tx-schema1",
            contestId: "contest-1",
            source: "markdown-schema-1",
            status: "migrated",
            backupPath: "Leif/.backups/migration-tx-schema1/manifest.json",
            diagnostics: []
          }
        ]
      }
    });
    expect(storage.saves[0]).toMatchObject({
      runtimeState: {
        migrationReceipts: [
          {
            id: "migration-tx-schema1",
            contestId: "contest-1",
            source: "markdown-schema-1",
            status: "started",
            backupPath: "Leif/.backups/migration-tx-schema1/manifest.json",
            diagnostics: []
          }
        ]
      }
    });
  });

  it("persists study changes to Markdown and keeps JSON operational-only", async () => {
    const storage = new MemoryStorageAdapter(createDefaultLeifPluginData());
    const markdown = new MemoryMarkdownFileStore();
    const store = new Schema2PluginDataStore(storage, markdown, () => "tx-save");
    const next = {
      ...createDefaultLeifPluginData(),
      activeContestId: "contest-1",
      contests: [new Contest("contest-1", "TRT", ["subject-1"])],
      cycleStates: [new CycleState("contest-1", "subject-1", "resource-1")],
      subjects: [
        new Subject("subject-1", "contest-1", "Português", 1, true, 0, undefined, ["resource-1"])
      ],
      resources: [new Resource("resource-1", "subject-1", "PDF 01", 1)]
    };

    await store.save(next);

    expect(markdown.files.get("Leif/concursos/trt/concurso.md")).toContain("# TRT");
    expect(markdown.files.get("Leif/concursos/trt/concurso.md")).toContain(
      'materia-atual: "[[materias/portugues/materia]]"'
    );
    expect(markdown.files.get("Leif/concursos/trt/concurso.md")).toContain(
      'recurso-atual: "[[materias/portugues/recursos/pdf-01/recurso]]"'
    );
    expect(storage.saved).toMatchObject({
      activeContestId: "contest-1",
      cycleStates: [],
      contests: [],
      subjects: [],
      topics: [],
      resources: [],
      studyRecords: []
    });
  });

  it("assigns IDs to valid unlisted child Markdown and links them through the sync plan", async () => {
    const topicPath = "Leif/concursos/trt/materias/portugues/assuntos/crase/assunto.md";
    const markdown = new MemoryMarkdownFileStore({
      ...markdownFiles,
      [topicPath]: `---
leif-type: assunto
leif-schema: 2
---

# Crase
`
    });
    const store = new Schema2PluginDataStore(
      new MemoryStorageAdapter(createDefaultLeifPluginData()),
      markdown,
      () => "tx-auto-id",
      () => "topic-new-id"
    );

    const loaded = await store.load();
    await store.save(loaded);

    expect(loaded.topics).toEqual([
      expect.objectContaining({ id: "topic-new-id", name: "Crase", subjectId: "subject-1" })
    ]);
    expect(markdown.files.get(topicPath)).toContain("leif-id: topic-new-id");
    expect(markdown.files.get("Leif/concursos/trt/materias/portugues/materia.md")).toContain(
      "[[assuntos/crase/assunto|Crase]]"
    );
    expect(markdown.files.get("Leif/diagnosticos.md")).toContain("SCHEMA2_OK");
  });

  it("serializes mutations through the Markdown writer", async () => {
    const markdown = new MemoryMarkdownFileStore();
    const store = new Schema2PluginDataStore(
      new MemoryStorageAdapter(createDefaultLeifPluginData()),
      markdown,
      () => "tx-mutate"
    );

    await store.mutate((data) => {
      data.activeContestId = "contest-1";
      data.contests.push(new Contest("contest-1", "TRT"));
      return "done";
    });

    expect(markdown.files.get("Leif/concursos/trt/concurso.md")).toContain("# TRT");
    expect((await store.load()).activeContestId).toBe("contest-1");
  });

  it("marks invalid Markdown contests read-only and rejects study mutations", async () => {
    const invalidMarkdown = {
      ...markdownFiles,
      "Leif/concursos/trt/materias/portugues/materia.md": `${doc("materia", "subject-1", "Português")}## Assuntos

<!-- leif:assuntos:start -->
1. [[assuntos/inexistente/assunto|Inexistente]]
<!-- leif:assuntos:end -->

## Recursos

<!-- leif:recursos:start -->
<!-- leif:recursos:end -->
`
    };
    const markdown = new MemoryMarkdownFileStore(invalidMarkdown);
    const store = new Schema2PluginDataStore(
      new MemoryStorageAdapter(createDefaultLeifPluginData()),
      markdown,
      () => "tx-invalid"
    );

    await store.load();

    expect(store.diagnostics()).toEqual([
      expect.objectContaining({ code: "SCHEMA2_BROKEN_WIKILINK" })
    ]);
    expect(store.readOnlyContestIds()).toEqual(["contest-1"]);

    await expect(
      store.mutate((data) => {
        data.contests.push(new Contest("contest-2", "Novo"));
      })
    ).rejects.toThrow(/read-only/i);
    expect(markdown.files.get("Leif/diagnosticos.md")).toContain("SCHEMA2_BROKEN_WIKILINK");
  });
});
