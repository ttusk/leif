import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { createLeifId } from "@/application/Id";
import type {
  MutableLeifPluginData,
  PluginDataDiagnostic,
  PluginDataStore as PluginDataStorePort
} from "@/application/ports/PluginDataStore";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import type { MigrationReceipt } from "@/domain/types/LeifRuntimeState";
import { Schema1MarkdownProjector } from "@/infrastructure/markdown/schema1/Schema1MarkdownProjector";
import { Schema2AtomicWriter } from "@/infrastructure/markdown/schema2/Schema2AtomicWriter";
import { Schema2Document } from "@/infrastructure/markdown/schema2/Schema2Document";
import { Schema2DomainCodec } from "@/infrastructure/markdown/schema2/Schema2DomainCodec";
import {
  Schema2WorkspaceIndex,
  type Schema2MarkdownFile
} from "@/infrastructure/markdown/schema2/Schema2WorkspaceIndex";
import {
  fingerprintSchema2Source,
  type Schema2FileChange,
  Schema2WorkspacePlanner
} from "@/infrastructure/markdown/schema2/Schema2WorkspacePlanner";
import {
  renderSchema2DiagnosticsMarkdown,
  Schema2WorkspaceValidator,
  type Schema2Diagnostic
} from "@/infrastructure/markdown/schema2/Schema2WorkspaceValidator";
import { DataMigrationService } from "@/infrastructure/persistence/DataMigrations";

/**
 * Markdown-authoritative data store for schema 2. JSON persists only
 * operational plugin state; study content is loaded from and written to
 * readable Markdown documents.
 */
export class Schema2PluginDataStore implements PluginDataStorePort {
  private readonly migrationService = new DataMigrationService();
  private readonly writer: Schema2AtomicWriter;
  private transactionTail: Promise<void> = Promise.resolve();
  private lastDiagnostics: Schema2Diagnostic[] = [];
  private lastReadOnlyContestIds: string[] = [];

  constructor(
    private readonly storageAdapter: PersistentStorageAdapter<LeifPluginData>,
    private readonly markdownStore: MarkdownFileStore,
    private readonly transactionIdFactory: () => string = () => Date.now().toString(36),
    private readonly idFactory: () => string = createLeifId
  ) {
    this.writer = new Schema2AtomicWriter(markdownStore);
  }

  async load(): Promise<LeifPluginData> {
    await this.transactionTail;
    return this.loadCurrentData();
  }

  async save(data: LeifPluginData): Promise<void> {
    await this.runExclusive(async () => {
      await this.persist(data);
    });
  }

  async mutate<T>(mutation: (draft: MutableLeifPluginData) => T | Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      const draft = structuredClone(await this.loadCurrentData());
      const result = await mutation(draft);
      await this.persist(draft);
      return result;
    });
  }

  diagnostics(): readonly PluginDataDiagnostic[] {
    return this.lastDiagnostics.map((diagnostic) => ({
      path: diagnostic.path ?? "Leif/diagnosticos.md",
      code: diagnostic.code,
      message: diagnostic.message
    }));
  }

  readOnlyContestIds(): readonly string[] {
    return this.lastReadOnlyContestIds;
  }

  private async loadCurrentData(): Promise<LeifPluginData> {
    const operational = await this.loadOperationalState();
    const failedReceiptContestIds = failedMigrationContestIds(operational);
    let markdownFiles = await this.readMarkdownFiles();
    const interruptedReceiptContestIds = interruptedMigrationContestIds(operational);
    if (interruptedReceiptContestIds.length > 0) {
      this.lastDiagnostics = interruptedMigrationDiagnostics(operational);
      this.lastReadOnlyContestIds = uniqueSorted([
        ...failedReceiptContestIds,
        ...interruptedReceiptContestIds
      ]);
      if (isSchema1Workspace(markdownFiles)) {
        return mergeStudyData(operational, Schema1MarkdownProjector.project(markdownFiles));
      }
      const markdownDiagnostics = Schema2WorkspaceValidator.validate(markdownFiles);
      if (markdownFiles.length > 0 && markdownDiagnostics.length === 0) {
        const decoded = Schema2DomainCodec.decode(Schema2WorkspaceIndex.build(markdownFiles));
        return mergeStudyData(operational, decoded);
      }
      return operational;
    }
    if (isSchema1Workspace(markdownFiles)) {
      return this.migrateSchema1MarkdownToSchema2(operational, markdownFiles);
    }
    markdownFiles = await this.assignMissingSchema2Ids(markdownFiles);
    const diagnostics = Schema2WorkspaceValidator.validate(markdownFiles);
    this.lastDiagnostics = diagnostics;
    this.lastReadOnlyContestIds =
      diagnostics.length > 0 ? collectReadableContestIds(markdownFiles) : failedReceiptContestIds;
    if (diagnostics.length > 0) {
      return mergeStudyData(operational, emptyStudyData());
    }
    if (markdownFiles.length === 0) {
      if (failedReceiptContestIds.length > 0) {
        return operational;
      }
      if (hasStudyData(operational)) {
        return this.migrateLegacyJsonToSchema2(operational);
      }
      return operational;
    }

    const decoded = Schema2DomainCodec.decode(Schema2WorkspaceIndex.build(markdownFiles));
    return mergeStudyData(operational, decoded);
  }

  private async persist(data: LeifPluginData): Promise<void> {
    const operational = await this.loadOperationalState();
    const blockedReceiptContestIds = uniqueSorted([
      ...failedMigrationContestIds(operational),
      ...interruptedMigrationContestIds(operational)
    ]);
    if (blockedReceiptContestIds.length > 0) {
      this.lastReadOnlyContestIds = blockedReceiptContestIds;
      this.lastDiagnostics = [
        ...interruptedMigrationDiagnostics(operational),
        ...this.lastDiagnostics
      ];
      throw new Error("Schema 2 Markdown workspace is read-only until diagnostics are fixed.");
    }

    const currentFiles = await this.assignMissingSchema2Ids(await this.readMarkdownFiles());
    const currentDiagnostics = Schema2WorkspaceValidator.validate(currentFiles);
    if (currentDiagnostics.length > 0) {
      this.lastDiagnostics = currentDiagnostics;
      this.lastReadOnlyContestIds = collectReadableContestIds(currentFiles);
      await this.writer.writeDiagnostics(renderSchema2DiagnosticsMarkdown(currentDiagnostics), {
        transactionId: this.transactionIdFactory()
      });
      throw new Error("Schema 2 Markdown workspace is read-only until diagnostics are fixed.");
    }

    const plan = Schema2WorkspacePlanner.plan(data, currentFiles);
    this.lastDiagnostics = plan.diagnostics;
    if (plan.diagnostics.length > 0) {
      await this.writer.writeDiagnostics(renderSchema2DiagnosticsMarkdown(plan.diagnostics), {
        transactionId: this.transactionIdFactory()
      });
      this.lastReadOnlyContestIds = collectReadableContestIds(currentFiles);
      throw new Error("Schema 2 Markdown workspace is read-only until diagnostics are fixed.");
    }

    await this.writer.apply(plan.changes, { transactionId: this.transactionIdFactory() });
    await this.writer.writeDiagnostics(renderSchema2DiagnosticsMarkdown([]), {
      transactionId: this.transactionIdFactory()
    });
    await this.storageAdapter.save(toOperationalState(data));
    this.lastReadOnlyContestIds = [];
  }

  private async migrateLegacyJsonToSchema2(data: LeifPluginData): Promise<LeifPluginData> {
    const transactionId = this.transactionIdFactory();
    const receiptId = `migration-${transactionId}`;
    const backupPath = `Leif/.backups/${receiptId}/data.json`;
    await this.markdownStore.writeNew(backupPath, `${JSON.stringify(data, null, 2)}\n`);

    const startedAt = new Date().toISOString();
    const startedReceipt = buildMigrationReceipt(
      data,
      receiptId,
      backupPath,
      "started",
      [],
      startedAt
    );
    await this.storageAdapter.save(withMigrationReceipt(data, startedReceipt));

    try {
      const plan = Schema2WorkspacePlanner.plan(data, []);
      if (plan.diagnostics.length > 0) {
        throw new Error("Legacy JSON data could not be planned as schema 2 Markdown.");
      }
      await this.writer.apply(plan.changes, { transactionId });

      const markdownFiles = await this.readMarkdownFiles();
      const decoded = Schema2DomainCodec.decode(Schema2WorkspaceIndex.build(markdownFiles));
      assertMigratedStudyDataMatches(data, decoded);

      const completedAt = new Date().toISOString();
      const receipt = buildMigrationReceipt(
        data,
        receiptId,
        backupPath,
        "migrated",
        [],
        completedAt
      );
      const migratedOperational = withMigrationReceipt(data, receipt);
      await this.storageAdapter.save(toOperationalState(migratedOperational));
      this.lastDiagnostics = [];
      this.lastReadOnlyContestIds = [];
      return mergeStudyData(migratedOperational, decoded);
    } catch (error) {
      const diagnostic = {
        code: "SCHEMA2_LEGACY_JSON_MIGRATION_FAILED",
        message: error instanceof Error ? error.message : "Legacy JSON migration failed."
      };
      const completedAt = new Date().toISOString();
      const receipt = buildMigrationReceipt(
        data,
        receiptId,
        backupPath,
        "failed",
        [diagnostic],
        completedAt
      );
      const failedOperational = withMigrationReceipt(data, receipt);
      await this.storageAdapter.save(toOperationalState(failedOperational));
      this.lastDiagnostics = [
        {
          ...diagnostic,
          severity: "erro",
          path: backupPath,
          guidance:
            "Corrija os dados legados ou recupere o backup antes de tentar migrar novamente."
        }
      ];
      this.lastReadOnlyContestIds = data.contests.map((contest) => contest.id);
      return failedOperational;
    }
  }

  private async migrateSchema1MarkdownToSchema2(
    operational: LeifPluginData,
    files: readonly Schema2MarkdownFile[]
  ): Promise<LeifPluginData> {
    const transactionId = this.transactionIdFactory();
    const receiptId = `migration-${transactionId}`;
    const backupPath = `Leif/.backups/${receiptId}/manifest.json`;
    await this.writeMarkdownBackupManifest(backupPath, files);

    const projected = Schema1MarkdownProjector.project(files);
    const data = mergeStudyData(operational, projected);
    const startedAt = new Date().toISOString();
    const startedReceipt = buildMigrationReceipt(
      data,
      receiptId,
      backupPath,
      "started",
      [],
      startedAt,
      "markdown-schema-1"
    );
    await this.storageAdapter.save(withMigrationReceipt(data, startedReceipt));

    try {
      const plan = Schema2WorkspacePlanner.plan(data, []);
      if (plan.diagnostics.length > 0) {
        throw new Error("Schema 1 Markdown could not be planned as schema 2 Markdown.");
      }
      for (const file of files) {
        if (await this.markdownStore.exists(file.path)) {
          await this.markdownStore.remove(file.path);
        }
      }
      await this.writer.apply(plan.changes, { transactionId });

      const markdownFiles = await this.readMarkdownFiles();
      const decoded = Schema2DomainCodec.decode(Schema2WorkspaceIndex.build(markdownFiles));
      assertMigratedStudyDataMatches(data, decoded);

      const completedAt = new Date().toISOString();
      const receipt = buildMigrationReceipt(
        data,
        receiptId,
        backupPath,
        "migrated",
        [],
        completedAt,
        "markdown-schema-1"
      );
      const migratedOperational = withMigrationReceipt(data, receipt);
      await this.storageAdapter.save(toOperationalState(migratedOperational));
      this.lastDiagnostics = [];
      this.lastReadOnlyContestIds = [];
      return mergeStudyData(migratedOperational, decoded);
    } catch (error) {
      const diagnostic = {
        code: "SCHEMA2_MARKDOWN_SCHEMA1_MIGRATION_FAILED",
        message: error instanceof Error ? error.message : "Schema 1 Markdown migration failed."
      };
      const completedAt = new Date().toISOString();
      const receipt = buildMigrationReceipt(
        data,
        receiptId,
        backupPath,
        "failed",
        [diagnostic],
        completedAt,
        "markdown-schema-1"
      );
      const failedOperational = withMigrationReceipt(data, receipt);
      await this.storageAdapter.save(toOperationalState(failedOperational));
      this.lastDiagnostics = [
        {
          ...diagnostic,
          severity: "erro",
          path: backupPath,
          guidance:
            "Corrija os arquivos schema 1 ou recupere o backup antes de tentar migrar novamente."
        }
      ];
      this.lastReadOnlyContestIds = data.contests.map((contest) => contest.id);
      return failedOperational;
    }
  }

  private async writeMarkdownBackupManifest(
    path: string,
    files: readonly Schema2MarkdownFile[]
  ): Promise<void> {
    await this.markdownStore.writeNew(
      path,
      `${JSON.stringify(
        {
          files: files.map((file) => ({ path: file.path, content: file.content }))
        },
        null,
        2
      )}\n`
    );
  }

  private async loadOperationalState(): Promise<LeifPluginData> {
    const stored = await this.storageAdapter.load();
    const defaults = createDefaultLeifPluginData();
    if (!stored) return defaults;
    const migrated = this.migrationService.migrate(stored);
    return {
      ...defaults,
      ...migrated,
      runtimeState: {
        ...defaults.runtimeState!,
        ...migrated.runtimeState
      }
    };
  }

  private async readMarkdownFiles(): Promise<Schema2MarkdownFile[]> {
    const paths = (await this.markdownStore.list("Leif/concursos")).filter((path) =>
      path.endsWith(".md")
    );
    const files: Schema2MarkdownFile[] = [];
    for (const path of paths) {
      files.push({ path, content: await this.markdownStore.read(path) });
    }
    return files;
  }

  private async assignMissingSchema2Ids(
    files: readonly Schema2MarkdownFile[]
  ): Promise<Schema2MarkdownFile[]> {
    const existingIds = collectExistingLeifIds(files);
    const changes: Schema2FileChange[] = [];
    const repaired = files.map((file) => {
      const content = assignMissingSchema2Id(file, () => this.nextUniqueId(existingIds));
      if (!content) return file;
      changes.push({
        kind: "update",
        path: file.path,
        content,
        expectedSourceFingerprint: fingerprintSchema2Source(file.content)
      });
      return { ...file, content };
    });

    if (changes.length > 0) {
      await this.writer.apply(changes, { transactionId: this.transactionIdFactory() });
    }
    return repaired;
  }

  private nextUniqueId(existingIds: Set<string>): string {
    let id = this.idFactory();
    while (existingIds.has(id)) {
      id = this.idFactory();
    }
    existingIds.add(id);
    return id;
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.transactionTail.then(operation, operation);
    this.transactionTail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

interface Schema2FrontmatterProtocol {
  properties: ReadonlyMap<string, string>;
  newline: "\n" | "\r\n";
}

const AUTO_ID_TYPES = new Set(["mural", "materia", "assunto", "recurso", "sessao", "registro"]);
const MERGE_MARKER = /^(?:<{7}|={7}|>{7})(?:\s|$)/m;

function collectExistingLeifIds(files: readonly Schema2MarkdownFile[]): Set<string> {
  return new Set(
    files
      .map((file) => parseProtocolFrontmatter(file.content)?.properties.get("leif-id")?.trim())
      .filter((id): id is string => id !== undefined && id.length > 0)
  );
}

function assignMissingSchema2Id(
  file: Schema2MarkdownFile,
  idFactory: () => string
): string | undefined {
  if (MERGE_MARKER.test(file.content)) return undefined;
  const protocol = parseProtocolFrontmatter(file.content);
  if (!protocol) return undefined;
  const type = protocol.properties.get("leif-type")?.trim();
  if (!type || !AUTO_ID_TYPES.has(type)) return undefined;
  if (protocol.properties.get("leif-schema")?.trim() !== "2") return undefined;
  if (protocol.properties.get("leif-id")?.trim()) return undefined;
  if (!isCanonicalAutoIdPath(file.path, type)) return undefined;
  if (!hasExactlyOneH1(file.content)) return undefined;
  return insertLeifId(file.content, idFactory(), protocol.newline);
}

function parseProtocolFrontmatter(source: string): Schema2FrontmatterProtocol | undefined {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return undefined;
  const properties = new Map<string, string>();
  match[1].split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) return;
    properties.set(
      line.slice(0, separator).trim(),
      unquoteScalar(line.slice(separator + 1).trim())
    );
  });
  return { properties, newline };
}

function insertLeifId(source: string, id: string, newline: "\n" | "\r\n"): string {
  const match = source.match(/^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
  if (!match) return source;
  const lines = match[2].split(/\r?\n/);
  const schemaIndex = lines.findIndex((line) => line.split(":", 1)[0].trim() === "leif-schema");
  lines.splice(schemaIndex >= 0 ? schemaIndex + 1 : lines.length, 0, `leif-id: ${id}`);
  return `${match[1]}${lines.join(newline)}${match[3]}${source.slice(match[0].length)}`;
}

function hasExactlyOneH1(source: string): boolean {
  return [...source.matchAll(/^#\s+.+$/gm)].length === 1;
}

function isCanonicalAutoIdPath(path: string, type: string): boolean {
  const parts = normalizeMarkdownPath(path).split("/");
  if (parts[0] !== "Leif" || parts[1] !== "concursos" || !parts[2]) return false;
  if (type === "mural") return parts.length === 4 && parts[3] === "mural.md";
  if (type === "materia") {
    return parts.length === 6 && parts[3] === "materias" && parts[5] === "materia.md";
  }
  if (type === "assunto") {
    return (
      parts.length === 8 &&
      parts[3] === "materias" &&
      parts[5] === "assuntos" &&
      parts[7] === "assunto.md"
    );
  }
  if (type === "recurso") {
    return (
      parts.length === 8 &&
      parts[3] === "materias" &&
      parts[5] === "recursos" &&
      parts[7] === "recurso.md"
    );
  }
  if (type === "sessao") {
    return (
      parts.length === 7 &&
      parts[3] === "sessoes" &&
      /^\d{4}-\d{2}$/.test(parts[4]) &&
      parts[6] === "sessao.md"
    );
  }
  if (type === "registro") {
    return (
      parts.length === 9 &&
      parts[3] === "sessoes" &&
      /^\d{4}-\d{2}$/.test(parts[4]) &&
      parts[6] === "registros" &&
      parts[8].endsWith(".md")
    );
  }
  return false;
}

function normalizeMarkdownPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function unquoteScalar(value: string): string {
  const quoted = value.match(/^"([\s\S]*)"$/);
  return quoted ? quoted[1] : value;
}

function mergeStudyData(
  operational: LeifPluginData,
  study: Pick<
    LeifPluginData,
    "contests" | "cycleStates" | "subjects" | "topics" | "resources" | "studySessions"
  >
): LeifPluginData {
  return {
    ...operational,
    contests: study.contests,
    cycleStates: study.cycleStates,
    subjects: study.subjects,
    topics: study.topics,
    resources: study.resources,
    studySessions: study.studySessions
  };
}

function emptyStudyData(): Pick<
  LeifPluginData,
  "contests" | "cycleStates" | "subjects" | "topics" | "resources" | "studySessions"
> {
  return {
    contests: [],
    cycleStates: [],
    subjects: [],
    topics: [],
    resources: [],
    studySessions: []
  };
}

function collectReadableContestIds(files: readonly Schema2MarkdownFile[]): string[] {
  const ids = files.flatMap((file) => {
    try {
      const document = Schema2Document.parse(file.content);
      return document.identity.type === "concurso" ? [document.identity.id] : [];
    } catch {
      return [];
    }
  });
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}

function isSchema1Workspace(files: readonly Schema2MarkdownFile[]): boolean {
  const leifFiles = files.filter((file) => file.content.includes("leif-schema:"));
  return leifFiles.length > 0 && leifFiles.every((file) => file.content.includes("leif-schema: 1"));
}

function hasStudyData(data: LeifPluginData): boolean {
  return (
    data.contests.length > 0 ||
    data.subjects.length > 0 ||
    data.topics.length > 0 ||
    data.resources.length > 0 ||
    data.studySessions.length > 0 ||
    data.cycleStates.length > 0
  );
}

function failedMigrationContestIds(data: LeifPluginData): string[] {
  return (data.runtimeState?.migrationReceipts ?? [])
    .filter((receipt) => receipt.status === "failed")
    .map((receipt) => receipt.contestId)
    .filter((contestId) => contestId !== "unknown")
    .sort((left, right) => left.localeCompare(right));
}

function interruptedMigrationContestIds(data: LeifPluginData): string[] {
  return uniqueSorted(
    (data.runtimeState?.migrationReceipts ?? [])
      .filter((receipt) => receipt.status === "started")
      .map((receipt) => receipt.contestId)
      .filter((contestId) => contestId !== "unknown")
  );
}

function interruptedMigrationDiagnostics(data: LeifPluginData): Schema2Diagnostic[] {
  return (data.runtimeState?.migrationReceipts ?? [])
    .filter((receipt) => receipt.status === "started")
    .map((receipt) => ({
      code: "SCHEMA2_MIGRATION_INTERRUPTED",
      severity: "erro" as const,
      path: receipt.backupPath,
      message: `A migração do concurso "${receipt.contestId}" foi interrompida antes da conclusão.`,
      guidance:
        "Use a recuperação de migração antes de editar este concurso; Leif não reiniciará a migração automaticamente."
    }));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function assertMigratedStudyDataMatches(
  before: LeifPluginData,
  after: Pick<
    LeifPluginData,
    "contests" | "cycleStates" | "subjects" | "topics" | "resources" | "studySessions"
  >
): void {
  const expected = {
    contests: before.contests.map((entry) => entry.id).sort(),
    cycleStates: before.cycleStates.map((entry) => entry.contestId).sort(),
    subjects: before.subjects.map((entry) => entry.id).sort(),
    topics: before.topics.map((entry) => entry.id).sort(),
    resources: before.resources.map((entry) => entry.id).sort(),
    studySessions: before.studySessions.map((entry) => entry.id).sort()
  };
  const actual = {
    contests: after.contests.map((entry) => entry.id).sort(),
    cycleStates: after.cycleStates.map((entry) => entry.contestId).sort(),
    subjects: after.subjects.map((entry) => entry.id).sort(),
    topics: after.topics.map((entry) => entry.id).sort(),
    resources: after.resources.map((entry) => entry.id).sort(),
    studySessions: after.studySessions.map((entry) => entry.id).sort()
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Schema 2 migration semantic comparison failed.");
  }
}

function buildMigrationReceipt(
  data: LeifPluginData,
  id: string,
  backupPath: string,
  status: MigrationReceipt["status"],
  diagnostics: MigrationReceipt["diagnostics"],
  timestamp: string,
  source: MigrationReceipt["source"] = "legacy-json"
): MigrationReceipt {
  const receipt: MigrationReceipt = {
    id,
    contestId: data.contests[0]?.id ?? "unknown",
    source,
    status,
    backupPath,
    diagnostics,
    createdAt: timestamp
  };
  if (status !== "started") {
    receipt.completedAt = timestamp;
  }
  return receipt;
}

function withMigrationReceipt(data: LeifPluginData, receipt: MigrationReceipt): LeifPluginData {
  const receipts = [...(data.runtimeState?.migrationReceipts ?? [])];
  const index = receipts.findIndex((candidate) => candidate.id === receipt.id);
  if (index === -1) receipts.push(receipt);
  else receipts[index] = receipt;
  return {
    ...data,
    runtimeState: {
      ...data.runtimeState!,
      migrationReceipts: receipts
    }
  };
}

function toOperationalState(data: LeifPluginData): LeifPluginData {
  return {
    ...createDefaultLeifPluginData(),
    schemaVersion: data.schemaVersion,
    activeContestId: data.activeContestId,
    cycleStates: [],
    runtimeState: data.runtimeState
  };
}
