import { describe, expect, it } from "vitest";

import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import {
  Schema2AtomicWriter,
  Schema2AtomicWriterError
} from "@/infrastructure/markdown/schema2/Schema2AtomicWriter";
import {
  fingerprintSchema2Source,
  type Schema2FileChange
} from "@/infrastructure/markdown/schema2/Schema2WorkspacePlanner";

class MemoryMarkdownFileStore implements MarkdownFileStore {
  readonly files = new Map<string, string>();
  readonly operations: string[] = [];
  onWriteNew?: (path: string) => void;

  constructor(initial: Record<string, string> = {}) {
    Object.entries(initial).forEach(([path, content]) => this.files.set(path, content));
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async writeNew(path: string, content: string): Promise<void> {
    this.operations.push(`writeNew:${path}`);
    if (this.files.has(path)) throw new Error(`Path exists: ${path}`);
    this.files.set(path, content);
    this.onWriteNew?.(path);
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
    this.operations.push(`move:${source}->${destination}`);
    const content = this.files.get(source);
    if (content === undefined) throw new Error(`Missing source: ${source}`);
    if (this.files.has(destination)) throw new Error(`Destination exists: ${destination}`);
    this.files.delete(source);
    this.files.set(destination, content);
  }

  async remove(path: string): Promise<void> {
    this.operations.push(`remove:${path}`);
    this.files.delete(path);
  }
}

describe("Schema2AtomicWriter", () => {
  it("stages creates and updates before applying them to target paths", async () => {
    const current = "old content";
    const store = new MemoryMarkdownFileStore({
      "Leif/concursos/trt/concurso.md": current,
      "Leif/concursos/trt/obsolete.md": "old"
    });
    const changes: Schema2FileChange[] = [
      {
        kind: "update",
        path: "Leif/concursos/trt/concurso.md",
        content: "new content",
        expectedSourceFingerprint: fingerprintSchema2Source(current)
      },
      {
        kind: "create",
        path: "Leif/concursos/trt/mural.md",
        content: "mural content"
      },
      {
        kind: "delete",
        path: "Leif/concursos/trt/obsolete.md",
        expectedSourceFingerprint: fingerprintSchema2Source("old")
      }
    ];

    await new Schema2AtomicWriter(store).apply(changes, { transactionId: "tx-1" });

    expect(store.files.get("Leif/concursos/trt/concurso.md")).toBe("new content");
    expect(store.files.get("Leif/concursos/trt/mural.md")).toBe("mural content");
    expect(store.files.has("Leif/concursos/trt/obsolete.md")).toBe(false);
    expect(store.operations).toEqual([
      "writeNew:Leif/.staging/tx-1/Leif/concursos/trt/concurso.md",
      "writeNew:Leif/.staging/tx-1/Leif/concursos/trt/mural.md",
      "remove:Leif/concursos/trt/concurso.md",
      "move:Leif/.staging/tx-1/Leif/concursos/trt/concurso.md->Leif/concursos/trt/concurso.md",
      "move:Leif/.staging/tx-1/Leif/concursos/trt/mural.md->Leif/concursos/trt/mural.md",
      "remove:Leif/concursos/trt/obsolete.md"
    ]);
  });

  it("aborts when a source fingerprint changes after staging", async () => {
    const current = "old content";
    const store = new MemoryMarkdownFileStore({
      "Leif/concursos/trt/concurso.md": current
    });
    store.onWriteNew = () => {
      store.files.set("Leif/concursos/trt/concurso.md", "externally changed");
    };

    await expect(
      new Schema2AtomicWriter(store).apply(
        [
          {
            kind: "update",
            path: "Leif/concursos/trt/concurso.md",
            content: "new content",
            expectedSourceFingerprint: fingerprintSchema2Source(current)
          }
        ],
        { transactionId: "tx-2" }
      )
    ).rejects.toThrow(Schema2AtomicWriterError);

    expect(store.files.get("Leif/concursos/trt/concurso.md")).toBe("externally changed");
    expect(store.operations).toEqual([
      "writeNew:Leif/.staging/tx-2/Leif/concursos/trt/concurso.md"
    ]);
  });

  it("writes diagnostics to a dedicated generated file", async () => {
    const store = new MemoryMarkdownFileStore({
      "Leif/diagnosticos.md": "old diagnostics"
    });

    await new Schema2AtomicWriter(store).writeDiagnostics("# Diagnósticos\n", {
      transactionId: "tx-3"
    });

    expect(store.files.get("Leif/diagnosticos.md")).toBe("# Diagnósticos\n");
    expect(store.operations).toEqual([
      "writeNew:Leif/.staging/tx-3/Leif/diagnosticos.md",
      "remove:Leif/diagnosticos.md",
      "move:Leif/.staging/tx-3/Leif/diagnosticos.md->Leif/diagnosticos.md"
    ]);
  });
});
