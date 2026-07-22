import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import {
  ManagedMarkdownDocument,
  MarkdownDocumentError
} from "@/infrastructure/markdown/ManagedMarkdownDocument";
import {
  MarkdownContestBundleCodec,
  type MarkdownFile
} from "@/infrastructure/markdown/MarkdownContestBundleCodec";

export interface MarkdownIndexDiagnostic {
  path: string;
  code: string;
  message: string;
}

export interface MarkdownIndexResult extends LeifPluginData {
  diagnostics: MarkdownIndexDiagnostic[];
}

export class MarkdownContestIndex {
  private readonly codec = new MarkdownContestBundleCodec();
  private readonly lastKnownGood = new Map<string, LeifPluginData>();

  constructor(private readonly files: MarkdownFileStore) {}

  async refresh(markdownRoot: string): Promise<MarkdownIndexResult> {
    const paths = (await this.files.list(`${markdownRoot}/concursos`)).filter(
      (path) => path.endsWith(".md") && !path.includes("/.staging/")
    );
    const contestRoots = paths
      .filter((path) => path.endsWith("/concurso.md"))
      .map((path) => path.slice(0, -"/concurso.md".length));
    const projections: LeifPluginData[] = [];
    const diagnostics: MarkdownIndexDiagnostic[] = [];

    for (const root of contestRoots) {
      const bundlePaths = paths.filter((path) => path.startsWith(`${root}/`));
      const bundle: MarkdownFile[] = [];
      let invalid = false;
      for (const path of bundlePaths) {
        const content = await this.files.read(path);
        if (!/^---\r?\n[\s\S]*?^leif-type:\s*/m.test(content)) continue;
        try {
          ManagedMarkdownDocument.parse(content);
          bundle.push({ path, content });
        } catch (error) {
          invalid = true;
          diagnostics.push(toDiagnostic(path, error));
        }
      }

      if (!invalid) {
        try {
          const projection = this.codec.decode(bundle);
          this.lastKnownGood.set(root, projection);
          projections.push(projection);
          continue;
        } catch (error) {
          diagnostics.push(toDiagnostic(`${root}/concurso.md`, error));
        }
      }

      const fallback = this.lastKnownGood.get(root);
      if (fallback) projections.push(fallback);
    }

    return mergeProjections(projections, diagnostics);
  }
}

function mergeProjections(
  projections: readonly LeifPluginData[],
  diagnostics: MarkdownIndexDiagnostic[]
): MarkdownIndexResult {
  const result = createDefaultLeifPluginData() as MarkdownIndexResult;
  result.diagnostics = diagnostics;
  projections.forEach((projection) => {
    result.contests.push(...projection.contests);
    result.subjects.push(...projection.subjects);
    result.topics.push(...projection.topics);
    result.studyItems.push(...projection.studyItems);
    result.studySessions.push(...projection.studySessions);
  });
  return result;
}

function toDiagnostic(path: string, error: unknown): MarkdownIndexDiagnostic {
  if (error instanceof MarkdownDocumentError) {
    return { path, code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "invalid-bundle";
    return { path, code, message: error.message };
  }
  return { path, code: "invalid-bundle", message: String(error) };
}
