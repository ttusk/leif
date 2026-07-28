import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import { fingerprintSchema2Source, type Schema2FileChange } from "./Schema2WorkspacePlanner";

export type Schema2AtomicWriterErrorCode = "source-fingerprint-mismatch" | "target-already-exists";

export class Schema2AtomicWriterError extends Error {
  constructor(
    public readonly code: Schema2AtomicWriterErrorCode,
    message: string
  ) {
    super(message);
    this.name = "Schema2AtomicWriterError";
  }
}

export interface Schema2AtomicWriterOptions {
  transactionId: string;
  stagingRoot?: string;
}

interface StagedContentChange {
  change: Extract<Schema2FileChange, { kind: "create" | "update" }>;
  stagedPath: string;
}

/**
 * Applies already-planned schema-2 file changes. This class does not validate
 * semantic correctness and does not compute paths; it only stages bytes, checks
 * source fingerprints immediately before target mutation, then swaps files.
 */
export class Schema2AtomicWriter {
  constructor(private readonly store: MarkdownFileStore) {}

  async apply(
    changes: readonly Schema2FileChange[],
    options: Schema2AtomicWriterOptions
  ): Promise<void> {
    const staged = await this.stageContentChanges(changes, options);
    await this.verifyTargets(changes);
    await this.applyStagedChanges(changes, staged);
  }

  async writeDiagnostics(
    content: string,
    options: Schema2AtomicWriterOptions,
    path = "Leif/diagnosticos.md"
  ): Promise<void> {
    await this.apply(
      (await this.store.exists(path))
        ? [
            {
              kind: "update",
              path,
              content,
              expectedSourceFingerprint: fingerprintSchema2Source(await this.store.read(path))
            }
          ]
        : [{ kind: "create", path, content }],
      options
    );
  }

  private async stageContentChanges(
    changes: readonly Schema2FileChange[],
    options: Schema2AtomicWriterOptions
  ): Promise<StagedContentChange[]> {
    const staged: StagedContentChange[] = [];
    for (const change of changes) {
      if (change.kind === "delete") continue;
      const stagedPath = stagingPathFor(change.path, options);
      await this.store.writeNew(stagedPath, change.content);
      staged.push({ change, stagedPath });
    }
    return staged;
  }

  private async verifyTargets(changes: readonly Schema2FileChange[]): Promise<void> {
    for (const change of changes) {
      if (change.kind === "create") {
        if (await this.store.exists(change.path)) {
          throw new Schema2AtomicWriterError(
            "target-already-exists",
            `Target "${change.path}" already exists.`
          );
        }
        continue;
      }

      const current = await this.store.read(change.path);
      const actual = fingerprintSchema2Source(current);
      if (actual !== change.expectedSourceFingerprint) {
        throw new Schema2AtomicWriterError(
          "source-fingerprint-mismatch",
          `Source "${change.path}" changed before the schema-2 writer could apply the plan.`
        );
      }
    }
  }

  private async applyStagedChanges(
    changes: readonly Schema2FileChange[],
    staged: readonly StagedContentChange[]
  ): Promise<void> {
    const stagedByPath = new Map(staged.map((entry) => [entry.change.path, entry]));
    for (const change of changes) {
      if (change.kind === "delete") {
        await this.store.remove(change.path);
        continue;
      }

      if (change.kind === "update") {
        await this.store.remove(change.path);
      }
      const stagedChange = stagedByPath.get(change.path);
      if (!stagedChange) continue;
      await this.store.move(stagedChange.stagedPath, change.path);
    }
  }
}

function stagingPathFor(path: string, options: Schema2AtomicWriterOptions): string {
  const root = options.stagingRoot ?? "Leif/.staging";
  return `${root}/${options.transactionId}/${path}`;
}
