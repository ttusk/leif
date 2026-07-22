import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { MigrationSafetyService } from "@/application/services/MigrationSafetyService";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import type { MigrationReceipt } from "@/domain/types/LeifRuntimeState";
import {
  MarkdownContestBundleCodec,
  type MarkdownFile
} from "@/infrastructure/markdown/MarkdownContestBundleCodec";

export class StagedMarkdownMigrationService {
  private readonly safety = new MigrationSafetyService();
  private readonly codec = new MarkdownContestBundleCodec();

  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly files: MarkdownFileStore,
    private readonly now: () => Date = () => new Date()
  ) {}

  async migrate(contestId: string): Promise<MigrationReceipt> {
    const source = await this.dataStore.load();
    const alreadyActivated = source.runtimeState?.migrationReceipts.find(
      (receipt) => receipt.contestId === contestId && receipt.status === "activated"
    );
    if (alreadyActivated) return alreadyActivated;

    const createdAt = this.now().toISOString();
    const safeTimestamp = createdAt.replace(/[:.]/g, "-");
    const backupPath = `Leif/.backups/${contestId}-${safeTimestamp}.json`;
    const prepared = await this.safety.prepare(source, contestId, backupPath, createdAt);

    await this.files.writeNew(backupPath, prepared.backupContent);
    await this.recordReceipt(prepared.receipt);

    const encoded = this.codec.encode(source, contestId);
    const stageRoot = `Leif/.staging/${safePathSegment(prepared.receipt.id)}`;
    const staged = encoded.map((file) => ({
      path: file.path.replace(/^Leif\//, `${stageRoot}/`),
      content: file.content
    }));
    for (const file of staged) {
      await this.files.writeNew(file.path, file.content);
    }

    const readBack: MarkdownFile[] = [];
    for (const file of staged) {
      readBack.push({ path: file.path, content: await this.files.read(file.path) });
    }
    const decoded = this.codec.decode(readBack);
    const targetProjection = mergeDurableProjection(source, decoded, contestId);
    const verified = await this.safety.verify(prepared.receipt, source, targetProjection);
    await this.recordReceipt(verified);

    const finalContestRoot = encoded[0].path.replace(/\/concurso\.md$/, "");
    const stagedContestRoot = staged[0].path.replace(/\/concurso\.md$/, "");
    if (await this.files.exists(finalContestRoot)) {
      throw new Error(
        `Migration destination "${finalContestRoot}" already exists; Leif will not overwrite it.`
      );
    }
    await this.files.move(stagedContestRoot, finalContestRoot);

    const activated: MigrationReceipt = {
      ...verified,
      status: "activated",
      activatedAt: this.now().toISOString()
    };
    await this.dataStore.mutate((data) => {
      data.runtimeState = data.runtimeState!;
      data.runtimeState.contestStorage[contestId] = "vault-markdown";
      upsertReceipt(data, activated);
    });
    return activated;
  }

  private async recordReceipt(receipt: MigrationReceipt): Promise<void> {
    await this.dataStore.mutate((data) => upsertReceipt(data, receipt));
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
