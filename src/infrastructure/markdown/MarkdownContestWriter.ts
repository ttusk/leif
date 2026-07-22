import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { ManagedMarkdownDocument } from "@/infrastructure/markdown/ManagedMarkdownDocument";
import {
  MarkdownContestBundleCodec,
  type MarkdownFile
} from "@/infrastructure/markdown/MarkdownContestBundleCodec";

const MANAGED_PROPERTIES = new Set([
  "leif-type",
  "leif-schema",
  "leif-id",
  "name",
  "exam-date",
  "board",
  "weekly-study-hours",
  "weekly-question-goal",
  "contest-id",
  "kind",
  "label",
  "url",
  "subject-id",
  "weight",
  "score",
  "active",
  "planned-minutes",
  "stage",
  "title",
  "question-count",
  "total-pages",
  "resources-defined",
  "notebook-id",
  "notebook-name",
  "notebook-url",
  "notebook-solved",
  "notebook-correct",
  "notebook-notes",
  "owner-type",
  "owner-id",
  "resource-type",
  "notes",
  "type",
  "studied-at",
  "item-id",
  "topic-id",
  "phase",
  "reference",
  "count",
  "correct",
  "completed"
]);

export class MarkdownContestWriter {
  private readonly codec = new MarkdownContestBundleCodec();

  constructor(
    private readonly files: MarkdownFileStore,
    private readonly now: () => Date = () => new Date()
  ) {}

  async sync(data: LeifPluginData, contestId: string, markdownRoot: string): Promise<void> {
    const current = await this.findContestFiles(contestId, markdownRoot);
    const currentRoot = current.contestPath.slice(0, -"/concurso.md".length);
    const canonical = this.codec.encode(data, contestId);
    const canonicalRoot = canonical[0].path.slice(0, -"/concurso.md".length);
    const targetById = new Map(
      canonical.map((file) => {
        const document = ManagedMarkdownDocument.parse(file.content);
        return [document.identity.id, { file, document }] as const;
      })
    );
    const existingById = new Map(
      current.managed.map((file) => {
        const document = ManagedMarkdownDocument.parse(file.content);
        return [document.identity.id, { file, document }] as const;
      })
    );

    const timestamp = this.now().toISOString().replace(/[:.]/g, "-");
    const stageRoot = `${markdownRoot}/.staging/write-${safe(contestId)}-${timestamp}`;
    const backupRoot = `${markdownRoot}/.backups/writes/${safe(contestId)}-${timestamp}`;
    const stagedFiles: MarkdownFile[] = [];

    for (const [id, target] of targetById) {
      const existing = existingById.get(id);
      const relativePath = existing
        ? existing.file.path.slice(currentRoot.length + 1)
        : target.file.path.slice(canonicalRoot.length + 1);
      const content = existing
        ? mergeManagedDocument(existing.file.content, target.file.content)
        : target.file.content;
      stagedFiles.push({ path: `${stageRoot}/${relativePath}`, content });
    }
    current.ordinaryMarkdown.forEach((file) => {
      stagedFiles.push({
        path: `${stageRoot}/${file.path.slice(currentRoot.length + 1)}`,
        content: file.content
      });
    });

    for (const file of stagedFiles) await this.files.writeNew(file.path, file.content);

    const stagedManaged = stagedFiles.filter((file) => isLeifMarkdown(file.content));
    const decoded = this.codec.decode(stagedManaged);
    const expected = this.codec.decode(canonical);
    if (JSON.stringify(decoded) !== JSON.stringify(expected)) {
      throw new Error(
        "Staged Markdown write is not semantically equivalent; original files remain active."
      );
    }

    await this.files.move(currentRoot, backupRoot);
    try {
      await this.files.move(stageRoot, currentRoot);
    } catch (error) {
      await this.files.move(backupRoot, currentRoot);
      throw error;
    }

    for (const path of current.nonMarkdownPaths) {
      const relative = path.slice(currentRoot.length + 1);
      await this.files.move(`${backupRoot}/${relative}`, `${currentRoot}/${relative}`);
    }
  }

  private async findContestFiles(
    contestId: string,
    markdownRoot: string
  ): Promise<{
    contestPath: string;
    managed: MarkdownFile[];
    ordinaryMarkdown: MarkdownFile[];
    nonMarkdownPaths: string[];
  }> {
    const paths = await this.files.list(`${markdownRoot}/concursos`);
    const markdown: MarkdownFile[] = [];
    for (const path of paths.filter((candidate) => candidate.endsWith(".md"))) {
      markdown.push({ path, content: await this.files.read(path) });
    }
    const contest = markdown.find((file) => {
      if (!file.path.endsWith("/concurso.md") || !isLeifMarkdown(file.content)) return false;
      return ManagedMarkdownDocument.parse(file.content).identity.id === contestId;
    });
    if (!contest) throw new Error(`Markdown concurso "${contestId}" was not found.`);
    const root = contest.path.slice(0, -"/concurso.md".length);
    const underRoot = markdown.filter((file) => file.path.startsWith(`${root}/`));
    return {
      contestPath: contest.path,
      managed: underRoot.filter((file) => isLeifMarkdown(file.content)),
      ordinaryMarkdown: underRoot.filter((file) => !isLeifMarkdown(file.content)),
      nonMarkdownPaths: paths.filter((path) => path.startsWith(`${root}/`) && !path.endsWith(".md"))
    };
  }
}

function mergeManagedDocument(existingSource: string, targetSource: string): string {
  const target = ManagedMarkdownDocument.parse(targetSource);
  let merged = ManagedMarkdownDocument.parse(existingSource).replaceProperties(
    target.properties,
    MANAGED_PROPERTIES
  );
  for (const regionName of target.regionNames) {
    merged = ManagedMarkdownDocument.parse(merged).replaceRegion(
      regionName,
      target.readRegion(regionName)
    );
  }
  return merged;
}

function isLeifMarkdown(content: string): boolean {
  return /^---\r?\n[\s\S]*?^leif-type:\s*/m.test(content);
}

function safe(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
