import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import type { MarkdownIndexDiagnostic } from "@/infrastructure/markdown/MarkdownContestIndex";
import { MarkdownContestIndex } from "@/infrastructure/markdown/MarkdownContestIndex";
import { MarkdownContestWriter } from "@/infrastructure/markdown/MarkdownContestWriter";

export class MarkdownAwarePluginDataStore implements PluginDataStore {
  private transactionTail: Promise<void> = Promise.resolve();
  private diagnostics: readonly MarkdownIndexDiagnostic[] = [];

  constructor(
    private readonly legacy: PluginDataStore,
    private readonly index: MarkdownContestIndex,
    private readonly writer: MarkdownContestWriter
  ) {}

  get markdownDiagnostics(): readonly MarkdownIndexDiagnostic[] {
    return this.diagnostics;
  }

  async load(): Promise<LeifPluginData> {
    await this.transactionTail;
    return this.loadCurrent();
  }

  async save(data: LeifPluginData): Promise<void> {
    await this.runExclusive(async () => {
      const before = await this.loadCurrent();
      await this.commit(before, structuredClone(data));
    });
  }

  async mutate<T>(mutation: (draft: LeifPluginData) => T | Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      const before = await this.loadCurrent();
      const draft = structuredClone(before);
      const result = await mutation(draft);
      await this.commit(before, draft);
      return result;
    });
  }

  private async loadCurrent(): Promise<LeifPluginData> {
    const json = await this.legacy.load();
    const markdown = await this.index.refresh(json.runtimeState!.markdownRoot);
    this.diagnostics = markdown.diagnostics;
    const markdownContestIds = markdownContestIdSet(json);
    return overlayMarkdown(json, markdown, markdownContestIds);
  }

  private async commit(before: LeifPluginData, draft: LeifPluginData): Promise<void> {
    const markdownContestIds = markdownContestIdSet(before);
    for (const contestId of markdownContestIds) {
      if (durableFingerprint(before, contestId) !== durableFingerprint(draft, contestId)) {
        await this.writer.sync(draft, contestId, draft.runtimeState!.markdownRoot);
      }
    }

    const legacyCurrent = await this.legacy.load();
    const jsonDraft = restoreMarkdownSnapshots(draft, legacyCurrent, markdownContestIds);
    await this.legacy.save(jsonDraft);
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

function markdownContestIdSet(data: LeifPluginData): Set<string> {
  return new Set(
    Object.entries(data.runtimeState!.contestStorage)
      .filter(([, mode]) => mode === "vault-markdown")
      .map(([contestId]) => contestId)
  );
}

function overlayMarkdown(
  json: LeifPluginData,
  markdown: LeifPluginData,
  markdownContestIds: ReadonlySet<string>
): LeifPluginData {
  const availableIds = new Set(
    markdown.contests
      .filter((contest) => markdownContestIds.has(contest.id))
      .map((contest) => contest.id)
  );
  if (availableIds.size === 0) return json;
  const jsonSubjectIds = subjectIdsForContests(json, availableIds);
  return {
    ...json,
    contests: [
      ...json.contests.filter((contest) => !availableIds.has(contest.id)),
      ...markdown.contests.filter((contest) => availableIds.has(contest.id))
    ],
    subjects: [
      ...json.subjects.filter((subject) => !availableIds.has(subject.contestId)),
      ...markdown.subjects.filter((subject) => availableIds.has(subject.contestId))
    ],
    studyItems: [
      ...json.studyItems.filter((item) => !jsonSubjectIds.has(item.subjectId)),
      ...markdown.studyItems
    ],
    topics: [
      ...json.topics.filter((topic) => !jsonSubjectIds.has(topic.subjectId)),
      ...markdown.topics
    ],
    studySessions: [
      ...json.studySessions.filter((session) => !availableIds.has(session.contestId)),
      ...markdown.studySessions.filter((session) => availableIds.has(session.contestId))
    ]
  };
}

function restoreMarkdownSnapshots(
  draft: LeifPluginData,
  legacy: LeifPluginData,
  markdownContestIds: ReadonlySet<string>
): LeifPluginData {
  const draftSubjectIds = subjectIdsForContests(draft, markdownContestIds);
  const legacySubjectIds = subjectIdsForContests(legacy, markdownContestIds);
  return {
    ...draft,
    contests: [
      ...draft.contests.filter((contest) => !markdownContestIds.has(contest.id)),
      ...legacy.contests.filter((contest) => markdownContestIds.has(contest.id))
    ],
    subjects: [
      ...draft.subjects.filter((subject) => !markdownContestIds.has(subject.contestId)),
      ...legacy.subjects.filter((subject) => markdownContestIds.has(subject.contestId))
    ],
    studyItems: [
      ...draft.studyItems.filter((item) => !draftSubjectIds.has(item.subjectId)),
      ...legacy.studyItems.filter((item) => legacySubjectIds.has(item.subjectId))
    ],
    topics: [
      ...draft.topics.filter((topic) => !draftSubjectIds.has(topic.subjectId)),
      ...legacy.topics.filter((topic) => legacySubjectIds.has(topic.subjectId))
    ],
    studySessions: [
      ...draft.studySessions.filter((session) => !markdownContestIds.has(session.contestId)),
      ...legacy.studySessions.filter((session) => markdownContestIds.has(session.contestId))
    ]
  };
}

function subjectIdsForContests(data: LeifPluginData, contestIds: ReadonlySet<string>): Set<string> {
  return new Set(
    data.subjects
      .filter((subject) => contestIds.has(subject.contestId))
      .map((subject) => subject.id)
  );
}

function durableFingerprint(data: LeifPluginData, contestId: string): string {
  const subjectIds = new Set(
    data.subjects.filter((subject) => subject.contestId === contestId).map((subject) => subject.id)
  );
  return JSON.stringify({
    contest: data.contests.find((contest) => contest.id === contestId),
    subjects: data.subjects.filter((subject) => subject.contestId === contestId),
    items: data.studyItems.filter((item) => subjectIds.has(item.subjectId)),
    topics: data.topics.filter((topic) => subjectIds.has(topic.subjectId)),
    sessions: data.studySessions.filter((session) => session.contestId === contestId)
  });
}
