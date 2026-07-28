import { describe, expect, it } from "vitest";

import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import { Contest } from "@/domain/entities/Contest";
import { Resource } from "@/domain/entities/Resource";
import { Subject } from "@/domain/entities/Subject";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import { Schema2BackupRecoveryService } from "@/infrastructure/persistence/Schema2BackupRecoveryService";

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

describe("Schema2BackupRecoveryService", () => {
  it("lists compatible JSON backups and restores one into staging only", async () => {
    const backup = {
      ...createDefaultLeifPluginData(),
      contests: [new Contest("contest-1", "TRT", ["subject-1"])],
      subjects: [
        new Subject("subject-1", "contest-1", "Português", 1, true, 0, undefined, ["resource-1"])
      ],
      resources: [new Resource("resource-1", "subject-1", "PDF 01", 1)]
    };
    const markdown = new MemoryMarkdownFileStore({
      "Leif/.backups/migration-tx/data.json": `${JSON.stringify(backup, null, 2)}\n`,
      "Leif/.backups/notes.txt": "ignore"
    });
    const service = new Schema2BackupRecoveryService(markdown, () => "recover-tx");

    await expect(service.listCompatibleBackups()).resolves.toEqual([
      "Leif/.backups/migration-tx/data.json"
    ]);

    const result = await service.restoreJsonBackupToStaging("Leif/.backups/migration-tx/data.json");

    expect(result).toMatchObject({
      backupPath: "Leif/.backups/migration-tx/data.json",
      stagingRoot: "Leif/.staging/recovery-recover-tx",
      diagnostics: []
    });
    expect(result.files).toEqual(
      expect.arrayContaining([
        "Leif/.staging/recovery-recover-tx/Leif/concursos/trt/concurso.md",
        "Leif/.staging/recovery-recover-tx/Leif/concursos/trt/materias/portugues/materia.md"
      ])
    );
    expect(
      markdown.files.get("Leif/.staging/recovery-recover-tx/Leif/concursos/trt/concursos.md")
    ).toBeUndefined();
    expect(
      markdown.files.get("Leif/.staging/recovery-recover-tx/Leif/concursos/trt/concurso.md")
    ).toContain("leif-schema: 2");
    expect(markdown.files.has("Leif/concursos/trt/concurso.md")).toBe(false);
  });

  it("validates and activates recovered staging files without restoring JSON authority", async () => {
    const backup = {
      ...createDefaultLeifPluginData(),
      contests: [new Contest("contest-1", "TRT", ["subject-1"])],
      subjects: [
        new Subject("subject-1", "contest-1", "Português", 1, true, 0, undefined, ["resource-1"])
      ],
      resources: [new Resource("resource-1", "subject-1", "PDF 01", 1)]
    };
    const markdown = new MemoryMarkdownFileStore({
      "Leif/.backups/migration-tx/data.json": `${JSON.stringify(backup, null, 2)}\n`
    });
    const service = new Schema2BackupRecoveryService(markdown, () => "activate");
    const recovered = await service.restoreBackupToStaging("Leif/.backups/migration-tx/data.json");

    const activated = await service.activateStagedRecovery(recovered.stagingRoot);

    expect(activated.diagnostics).toEqual([]);
    expect(activated.files).toEqual(
      expect.arrayContaining([
        "Leif/concursos/trt/concurso.md",
        "Leif/concursos/trt/materias/portugues/materia.md"
      ])
    );
    expect(markdown.files.get("Leif/concursos/trt/concurso.md")).toContain("leif-schema: 2");
    expect(
      markdown.files.has("Leif/.staging/recovery-activate/Leif/concursos/trt/concurso.md")
    ).toBe(false);
    expect(markdown.files.get("Leif/.backups/migration-tx/data.json")).toContain("contest-1");
  });

  it("refuses to activate recovered staging files over an existing destination", async () => {
    const backup = {
      ...createDefaultLeifPluginData(),
      contests: [new Contest("contest-1", "TRT")]
    };
    const markdown = new MemoryMarkdownFileStore({
      "Leif/.backups/migration-tx/data.json": `${JSON.stringify(backup, null, 2)}\n`,
      "Leif/concursos/trt/concurso.md": "existing"
    });
    const service = new Schema2BackupRecoveryService(markdown, () => "collision");
    const recovered = await service.restoreBackupToStaging("Leif/.backups/migration-tx/data.json");

    await expect(service.activateStagedRecovery(recovered.stagingRoot)).rejects.toThrow(
      /already exists/i
    );
    expect(markdown.files.get("Leif/concursos/trt/concurso.md")).toBe("existing");
    expect(
      markdown.files.get("Leif/.staging/recovery-collision/Leif/concursos/trt/concurso.md")
    ).toContain("leif-schema: 2");
  });

  it("returns diagnostics and keeps staging untouched when activation validation fails", async () => {
    const backup = {
      ...createDefaultLeifPluginData(),
      contests: [new Contest("contest-1", "TRT", ["subject-1"])],
      subjects: [new Subject("subject-1", "contest-1", "Português", 1)]
    };
    const markdown = new MemoryMarkdownFileStore({
      "Leif/.backups/migration-tx/data.json": `${JSON.stringify(backup, null, 2)}\n`
    });
    const service = new Schema2BackupRecoveryService(markdown, () => "invalid");
    const recovered = await service.restoreBackupToStaging("Leif/.backups/migration-tx/data.json");
    const stagedContestPath = `${recovered.stagingRoot}/Leif/concursos/trt/concurso.md`;
    markdown.files.set(
      stagedContestPath,
      markdown.files
        .get(stagedContestPath)!
        .replace(
          "[[materias/portugues/materia|Português]]",
          "[[materias/inexistente/materia|Inexistente]]"
        )
    );

    const activated = await service.activateStagedRecovery(recovered.stagingRoot);

    expect(activated.diagnostics).toEqual([
      expect.objectContaining({ code: "SCHEMA2_BROKEN_WIKILINK" })
    ]);
    expect(markdown.files.has("Leif/concursos/trt/concurso.md")).toBe(false);
    expect(markdown.files.get(stagedContestPath)).toContain("materias/inexistente");
  });

  it("lists schema-1 manifest backups and restores them into schema-2 staging", async () => {
    const manifest = {
      files: [
        {
          path: "Leif/concursos/trt/concurso.md",
          content:
            schema1Doc("concurso", "contest-1", "TRT") +
            `## Matérias

<!-- leif:subjects:start -->
1. [[materias/portugues|Português]] ^leif-ref-7375626a6563742d31
<!-- leif:subjects:end -->
`
        },
        {
          path: "Leif/concursos/trt/materias/portugues.md",
          content: schema1Doc("materia", "subject-1", "Português", "contest-id: contest-1\n")
        }
      ]
    };
    const markdown = new MemoryMarkdownFileStore({
      "Leif/.backups/migration-schema1/manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });
    const service = new Schema2BackupRecoveryService(markdown, () => "schema1");

    await expect(service.listCompatibleBackups()).resolves.toEqual([
      "Leif/.backups/migration-schema1/manifest.json"
    ]);

    const result = await service.restoreBackupToStaging(
      "Leif/.backups/migration-schema1/manifest.json"
    );

    expect(result).toMatchObject({
      backupPath: "Leif/.backups/migration-schema1/manifest.json",
      stagingRoot: "Leif/.staging/recovery-schema1",
      diagnostics: []
    });
    expect(
      markdown.files.get("Leif/.staging/recovery-schema1/Leif/concursos/trt/concurso.md")
    ).toContain("[[materias/portugues/materia|Português]]");
    expect(
      markdown.files.get(
        "Leif/.staging/recovery-schema1/Leif/concursos/trt/materias/portugues/materia.md"
      )
    ).toContain("leif-type: materia");
  });
});

function schema1Doc(type: string, id: string, title: string, extra = ""): string {
  return `---
leif-type: ${type}
leif-schema: 1
leif-id: ${id}
${extra}---

# ${title}
`;
}
