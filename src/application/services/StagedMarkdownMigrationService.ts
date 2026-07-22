import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import {
  MigrationSafetyService,
  type MigrationDiagnostic
} from "@/application/services/MigrationSafetyService";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import type { MigrationReceipt } from "@/domain/types/LeifRuntimeState";
import {
  MarkdownContestBundleCodec,
  type MarkdownFile
} from "@/infrastructure/markdown/MarkdownContestBundleCodec";
import { MARKDOWN_WORKSPACE_FILES } from "@/infrastructure/markdown/MarkdownWorkspaceFiles";
import { ManagedMarkdownDocument } from "@/infrastructure/markdown/ManagedMarkdownDocument";

export interface MigrationPreview {
  contestId: string;
  files: string[];
  diagnostics: MigrationDiagnostic[];
  blocked: boolean;
}

export class StagedMarkdownMigrationService {
  private readonly safety = new MigrationSafetyService();
  private readonly codec = new MarkdownContestBundleCodec();

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly files: MarkdownFileStore,
    private readonly now: () => Date = () => new Date()
  ) {}

  async preview(contestId: string): Promise<MigrationPreview> {
    const source = await this.dataStore.load();
    const diagnostics = this.safety.validateRawData(source);
    const contest = source.contests.find((candidate) => candidate.id === contestId);
    if (!contest) {
      diagnostics.push({
        code: "missing-contest",
        entityId: contestId,
        message: `O concurso "${contestId}" não existe.`
      });
      return { contestId, files: [], diagnostics, blocked: true };
    }

    const encoded = this.codec.encode(source, contestId);
    const files = encoded.map((file) => file.path);
    const finalContestRoot = encoded[0]?.path.replace(/\/concurso\.md$/, "");
    if (finalContestRoot && (await this.files.exists(finalContestRoot))) {
      diagnostics.push({
        code: "destination-exists",
        entityId: contestId,
        message: `O destino da migração "${finalContestRoot}" já existe.`
      });
    }

    return { contestId, files, diagnostics, blocked: diagnostics.length > 0 };
  }

  async migrate(contestId: string): Promise<MigrationReceipt> {
    const source = await this.dataStore.load();
    const alreadyActivated = source.runtimeState?.migrationReceipts.find(
      (receipt) => receipt.contestId === contestId && receipt.status === "activated"
    );
    if (alreadyActivated) return alreadyActivated;
    const recovered = await this.recoverVerifiedMigration(source, contestId);
    if (recovered) return recovered;

    const pending = [...(source.runtimeState?.migrationReceipts ?? [])]
      .reverse()
      .find((receipt) => receipt.contestId === contestId && receipt.status === "backed-up");
    const receipt = pending ?? (await this.prepareNewMigration(source, contestId));
    if (pending) await this.assertPendingMigrationCanResume(source, pending);
    await this.ensureWorkspaceFiles();

    const encoded = this.codec.encode(source, contestId);
    const stageRoot = `Leif/.staging/${safePathSegment(receipt.id)}`;
    const staged = encoded.map((file) => ({
      path: file.path.replace(/^Leif\//, `${stageRoot}/`),
      content: file.content
    }));
    for (const file of staged) {
      if (!(await this.files.exists(file.path))) {
        await this.files.writeNew(file.path, file.content);
        continue;
      }
      if ((await this.files.read(file.path)) !== file.content) {
        throw new Error(
          `O arquivo parcial "${file.path}" difere da fonte atual. O JSON legado continua sendo a fonte.`
        );
      }
    }

    const readBack: MarkdownFile[] = [];
    for (const file of staged) {
      readBack.push({ path: file.path, content: await this.files.read(file.path) });
    }
    const decoded = this.codec.decode(readBack);
    const targetProjection = mergeDurableProjection(source, decoded, contestId);
    const verified = await this.safety.verify(receipt, source, targetProjection);
    await this.recordReceipt(verified);

    const finalContestRoot = encoded[0].path.replace(/\/concurso\.md$/, "");
    const stagedContestRoot = staged[0].path.replace(/\/concurso\.md$/, "");
    if (await this.files.exists(finalContestRoot)) {
      throw new Error(
        `Migration destination "${finalContestRoot}" already exists; Leif will not overwrite it.`
      );
    }
    await this.files.move(stagedContestRoot, finalContestRoot);

    return this.activate(verified);
  }

  private async prepareNewMigration(
    source: LeifPluginData,
    contestId: string
  ): Promise<MigrationReceipt> {
    const createdAt = this.now().toISOString();
    const safeTimestamp = createdAt.replace(/[:.]/g, "-");
    const backupPath = `Leif/.backups/${contestId}-${safeTimestamp}.json`;
    const prepared = await this.safety.prepare(source, contestId, backupPath, createdAt);
    await this.files.writeNew(backupPath, prepared.backupContent);
    await this.recordReceipt(prepared.receipt);
    return prepared.receipt;
  }

  private async assertPendingMigrationCanResume(
    source: LeifPluginData,
    receipt: MigrationReceipt
  ): Promise<void> {
    if (!(await this.files.exists(receipt.backupPath))) {
      throw new Error(`O backup parcial "${receipt.backupPath}" não existe.`);
    }
    const backup = await this.files.read(receipt.backupPath);
    if ((await sha256(backup)) !== receipt.backupChecksum) {
      throw new Error(`O backup parcial "${receipt.backupPath}" falhou na verificação.`);
    }
    if ((await this.safety.checksum(source, receipt.contestId)) !== receipt.sourceChecksum) {
      throw new Error(
        "A fonte mudou desde o backup parcial. O JSON legado continua sendo a fonte."
      );
    }
  }

  private async recordReceipt(receipt: MigrationReceipt): Promise<void> {
    await this.dataStore.mutate((data) => upsertReceipt(data, receipt));
  }

  private async ensureWorkspaceFiles(): Promise<void> {
    for (const file of MARKDOWN_WORKSPACE_FILES) {
      if (!(await this.files.exists(file.path))) {
        await this.files.writeNew(file.path, file.content);
      }
    }
  }

  private async recoverVerifiedMigration(
    source: LeifPluginData,
    contestId: string
  ): Promise<MigrationReceipt | null> {
    const verified = [...source.runtimeState!.migrationReceipts]
      .reverse()
      .find((receipt) => receipt.contestId === contestId && receipt.status === "verified");
    if (!verified?.targetChecksum) return null;

    const markdownRoot = source.runtimeState!.markdownRoot;
    const finalBundle = await this.findBundle(`${markdownRoot}/concursos`, contestId);
    if (finalBundle) {
      await this.assertRecoveredBundle(source, verified, finalBundle.files);
      return this.activate(verified);
    }

    const stageRoot = `${markdownRoot}/.staging/${safePathSegment(verified.id)}`;
    const stagedBundle = await this.findBundle(stageRoot, contestId);
    if (!stagedBundle) return null;
    await this.assertRecoveredBundle(source, verified, stagedBundle.files);
    const finalRoot = stagedBundle.root.replace(`${stageRoot}/`, `${markdownRoot}/`);
    if (await this.files.exists(finalRoot)) {
      throw new Error(`Cannot recover migration because "${finalRoot}" already exists.`);
    }
    await this.files.move(stagedBundle.root, finalRoot);
    return this.activate(verified);
  }

  private async findBundle(
    prefix: string,
    contestId: string
  ): Promise<{ root: string; files: MarkdownFile[] } | null> {
    const paths = (await this.files.list(prefix)).filter((path) => path.endsWith(".md"));
    for (const contestPath of paths.filter((path) => path.endsWith("/concurso.md"))) {
      const content = await this.files.read(contestPath);
      if (ManagedMarkdownDocument.parse(content).identity.id !== contestId) continue;
      const root = contestPath.slice(0, -"/concurso.md".length);
      const bundlePaths = paths.filter((path) => path.startsWith(`${root}/`));
      const files: MarkdownFile[] = [];
      for (const path of bundlePaths) files.push({ path, content: await this.files.read(path) });
      return { root, files };
    }
    return null;
  }

  private async assertRecoveredBundle(
    source: LeifPluginData,
    receipt: MigrationReceipt,
    files: MarkdownFile[]
  ): Promise<void> {
    if ((await this.safety.checksum(source, receipt.contestId)) !== receipt.sourceChecksum) {
      throw new Error(
        "A fonte da migração mudou antes da recuperação; o JSON legado continua sendo a fonte."
      );
    }
    const decoded = this.codec.decode(files);
    const projection = mergeDurableProjection(source, decoded, receipt.contestId);
    if ((await this.safety.checksum(projection, receipt.contestId)) !== receipt.targetChecksum) {
      throw new Error("O Markdown recuperado difere do destino verificado da migração.");
    }
  }

  private async activate(receipt: MigrationReceipt): Promise<MigrationReceipt> {
    const activated: MigrationReceipt = {
      ...receipt,
      status: "activated",
      activatedAt: this.now().toISOString()
    };
    await this.dataStore.mutate((data) => {
      data.runtimeState = data.runtimeState!;
      data.runtimeState.contestStorage[receipt.contestId] = "vault-markdown";
      upsertReceipt(data, activated);
    });
    return activated;
  }
}

function upsertReceipt(data: LeifPluginData, receipt: MigrationReceipt): void {
  data.runtimeState = data.runtimeState!;
  const index = data.runtimeState.migrationReceipts.findIndex(
    (candidate) => candidate.id === receipt.id
  );
  if (index === -1) data.runtimeState.migrationReceipts.push(receipt);
  else data.runtimeState.migrationReceipts[index] = receipt;
}

function mergeDurableProjection(
  source: LeifPluginData,
  decoded: LeifPluginData,
  contestId: string
): LeifPluginData {
  const sourceSubjectIds = new Set(
    source.subjects
      .filter((subject) => subject.contestId === contestId)
      .map((subject) => subject.id)
  );
  return {
    ...source,
    contests: [
      ...source.contests.filter((contest) => contest.id !== contestId),
      ...decoded.contests
    ],
    subjects: [
      ...source.subjects.filter((subject) => subject.contestId !== contestId),
      ...decoded.subjects
    ],
    studyItems: [
      ...source.studyItems.filter((item) => !sourceSubjectIds.has(item.subjectId)),
      ...decoded.studyItems
    ],
    topics: [
      ...source.topics.filter((topic) => !sourceSubjectIds.has(topic.subjectId)),
      ...decoded.topics
    ],
    studySessions: [
      ...source.studySessions.filter((session) => session.contestId !== contestId),
      ...decoded.studySessions
    ]
  };
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
