import type { Contest } from "@/domain/entities/Contest";
import type { Resource } from "@/domain/entities/Resource";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import type { StudySession } from "@/domain/entities/StudySession";
import type { Subject } from "@/domain/entities/Subject";
import type { Topic } from "@/domain/entities/Topic";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { Schema2EntityDocumentCodec } from "./Schema2EntityDocumentCodec";
import type { Schema2Diagnostic } from "./Schema2WorkspaceValidator";
import { Schema2WorkspaceValidator } from "./Schema2WorkspaceValidator";
import type { IndexedSchema2Document, Schema2MarkdownFile } from "./Schema2WorkspaceIndex";
import { Schema2WorkspaceIndex } from "./Schema2WorkspaceIndex";

export type Schema2FileChange =
  | {
      kind: "create";
      path: string;
      content: string;
    }
  | {
      kind: "update";
      path: string;
      content: string;
      expectedSourceFingerprint: string;
    }
  | {
      kind: "delete";
      path: string;
      expectedSourceFingerprint: string;
    };

export interface Schema2WorkspacePlan {
  diagnostics: Schema2Diagnostic[];
  changes: Schema2FileChange[];
}

interface DesiredDocument {
  id: string;
  path: string;
  render(existing?: IndexedSchema2Document): string;
}

interface PlannedPaths {
  contests: ReadonlyMap<string, string>;
  murals: ReadonlyMap<string, string>;
  subjects: ReadonlyMap<string, string>;
  topics: ReadonlyMap<string, string>;
  resources: ReadonlyMap<string, string>;
  sessions: ReadonlyMap<string, string>;
  records: ReadonlyMap<string, string>;
}

export class Schema2WorkspacePlanner {
  static plan(
    data: LeifPluginData,
    currentFiles: readonly Schema2MarkdownFile[]
  ): Schema2WorkspacePlan {
    let currentIndex: Schema2WorkspaceIndex | undefined;
    try {
      currentIndex =
        currentFiles.length > 0 ? Schema2WorkspaceIndex.build(currentFiles) : undefined;
    } catch {
      return { diagnostics: Schema2WorkspaceValidator.validate(currentFiles), changes: [] };
    }
    const currentById = new Map(
      currentIndex?.documents.map((document) => [document.id, document]) ?? []
    );
    const currentFileByPath = new Map(currentFiles.map((file) => [normalizePath(file.path), file]));
    const paths = planPaths(data, currentById);
    const desired = buildDesiredDocuments(data, paths, currentById);
    const desiredByPath = new Map(desired.map((document) => [document.path, document]));
    const changes: Schema2FileChange[] = [];

    desired.forEach((document) => {
      const current = currentById.get(document.id);
      const currentFile = current ? currentFileByPath.get(current.path) : undefined;
      const content = document.render(current);
      if (!current || !currentFile) {
        changes.push({ kind: "create", path: document.path, content });
        return;
      }
      if (current.path !== document.path) {
        changes.push({
          kind: "delete",
          path: current.path,
          expectedSourceFingerprint: fingerprintSchema2Source(currentFile.content)
        });
        changes.push({ kind: "create", path: document.path, content });
        return;
      }
      if (currentFile.content !== content) {
        changes.push({
          kind: "update",
          path: current.path,
          content,
          expectedSourceFingerprint: fingerprintSchema2Source(currentFile.content)
        });
      }
    });

    currentIndex?.documents.forEach((document) => {
      if (desiredByPath.has(document.path)) return;
      const currentFile = currentFileByPath.get(document.path);
      if (!currentFile) return;
      changes.push({
        kind: "delete",
        path: document.path,
        expectedSourceFingerprint: fingerprintSchema2Source(currentFile.content)
      });
    });

    return { diagnostics: [], changes: sortChanges(changes) };
  }
}

export function fingerprintSchema2Source(source: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function buildDesiredDocuments(
  data: LeifPluginData,
  paths: PlannedPaths,
  currentById: ReadonlyMap<string, IndexedSchema2Document>
): DesiredDocument[] {
  const contests = ordered(data.contests, (contest) => contest.name).map((contest) =>
    desiredContest(contest, data, paths)
  );
  const murals = ordered(data.contests, (contest) => contest.name).map((contest) =>
    desiredMural(contest, paths, currentById)
  );
  const subjects = ordered(data.subjects, (subject) =>
    [paths.contests.get(subject.contestId) ?? "", subject.order, subject.name].join("|")
  ).map((subject) => desiredSubject(subject, data, paths));
  const topics = ordered(data.topics, (topic) =>
    [paths.subjects.get(topic.subjectId) ?? "", topic.name].join("|")
  ).map((topic) => desiredTopic(topic, paths));
  const resources = ordered(data.resources, (resource) =>
    [paths.subjects.get(resource.subjectId) ?? "", resource.order, resource.title].join("|")
  ).map((resource) => desiredResource(resource, data, paths));
  const sessions = ordered(data.studySessions, (session) =>
    [
      paths.contests.get(session.contestId) ?? "",
      session.date,
      session.startTime ?? "",
      session.id
    ].join("|")
  ).map((session) => desiredSession(session, paths));
  const records = data.studySessions.flatMap((session) =>
    session.records.map((record, index) => desiredRecord(record, index, paths))
  );
  return [...contests, ...murals, ...subjects, ...topics, ...resources, ...sessions, ...records];
}

function desiredContest(
  contest: Contest,
  data: LeifPluginData,
  paths: PlannedPaths
): DesiredDocument {
  const path = requiredPath(paths.contests, contest.id);
  return {
    id: contest.id,
    path,
    render(existing) {
      const subjectLinks = contest.subjectIds
        .map((subjectId) => data.subjects.find((subject) => subject.id === subjectId))
        .filter((subject): subject is Subject => subject !== undefined)
        .map((subject) => ({
          target: relativeLink(path, requiredPath(paths.subjects, subject.id)),
          alias: subject.name
        }));
      const cycleState = data.cycleStates.find((state) => state.contestId === contest.id);
      const currentSubjectLink = cycleState?.currentSubjectId
        ? relativeLink(path, requiredPath(paths.subjects, cycleState.currentSubjectId))
        : undefined;
      const currentResourceLink = cycleState?.currentResourceId
        ? relativeLink(path, requiredPath(paths.resources, cycleState.currentResourceId))
        : undefined;
      if (existing) {
        return Schema2EntityDocumentCodec.updateContest(existing.document, contest, {
          subjectLinks,
          currentSubjectLink,
          currentResourceLink
        }).toString();
      }
      return Schema2EntityDocumentCodec.renderContest(contest, {
        subjectLinks,
        currentSubjectLink,
        currentResourceLink
      });
    }
  };
}

function desiredMural(
  contest: Contest,
  paths: PlannedPaths,
  currentById: ReadonlyMap<string, IndexedSchema2Document>
): DesiredDocument {
  const existingMural = [...currentById.values()].find(
    (document) =>
      document.type === "mural" && document.path === requiredPath(paths.murals, contest.id)
  );
  const id = existingMural?.id ?? `mural-${contest.id}`;
  return {
    id,
    path: requiredPath(paths.murals, contest.id),
    render(existing) {
      if (existing)
        return Schema2EntityDocumentCodec.updateMural(existing.document, contest.mural).toString();
      return Schema2EntityDocumentCodec.renderMural(id, contest.mural);
    }
  };
}

function desiredSubject(
  subject: Subject,
  data: LeifPluginData,
  paths: PlannedPaths
): DesiredDocument {
  const path = requiredPath(paths.subjects, subject.id);
  return {
    id: subject.id,
    path,
    render(existing) {
      const topicLinks = subject.topicIds
        .map((topicId) => data.topics.find((topic) => topic.id === topicId))
        .filter((topic): topic is Topic => topic !== undefined)
        .map((topic) => ({
          target: relativeLink(path, requiredPath(paths.topics, topic.id)),
          alias: topic.name
        }));
      const resourceLinks = subject.resourceIds
        .map((resourceId) => data.resources.find((resource) => resource.id === resourceId))
        .filter((resource): resource is Resource => resource !== undefined)
        .map((resource) => ({
          target: relativeLink(path, requiredPath(paths.resources, resource.id)),
          alias: resource.title
        }));
      if (existing) {
        return Schema2EntityDocumentCodec.updateSubject(existing.document, subject, {
          topicLinks,
          resourceLinks
        }).toString();
      }
      return Schema2EntityDocumentCodec.renderSubject(subject, { topicLinks, resourceLinks });
    }
  };
}

function desiredTopic(topic: Topic, paths: PlannedPaths): DesiredDocument {
  return {
    id: topic.id,
    path: requiredPath(paths.topics, topic.id),
    render(existing) {
      if (existing)
        return Schema2EntityDocumentCodec.updateTopic(existing.document, topic).toString();
      return Schema2EntityDocumentCodec.renderTopic(topic);
    }
  };
}

function desiredResource(
  resource: Resource,
  data: LeifPluginData,
  paths: PlannedPaths
): DesiredDocument {
  const path = requiredPath(paths.resources, resource.id);
  return {
    id: resource.id,
    path,
    render(existing) {
      const topicLinks = resource.topicIds.map((topicId) => ({
        target: relativeLink(path, requiredPath(paths.topics, topicId)),
        alias: data.topics.find((topic) => topic.id === topicId)?.name
      }));
      if (existing) {
        return Schema2EntityDocumentCodec.updateResource(existing.document, resource, {
          topicLinks
        }).toString();
      }
      return Schema2EntityDocumentCodec.renderResource(resource, { topicLinks });
    }
  };
}

function desiredSession(session: StudySession, paths: PlannedPaths): DesiredDocument {
  const path = requiredPath(paths.sessions, session.id);
  return {
    id: session.id,
    path,
    render(existing) {
      const recordLinks = session.records.map((record) => ({
        target: relativeLink(path, requiredPath(paths.records, record.id)),
        alias: record.activity
      }));
      if (existing) {
        return Schema2EntityDocumentCodec.updateSession(existing.document, session, {
          recordLinks
        }).toString();
      }
      return Schema2EntityDocumentCodec.renderSession(session, { recordLinks });
    }
  };
}

function desiredRecord(record: StudyRecord, index: number, paths: PlannedPaths): DesiredDocument {
  const path = requiredPath(paths.records, record.id);
  return {
    id: record.id,
    path,
    render(existing) {
      const options = {
        subjectLink: relativeLink(path, requiredPath(paths.subjects, record.subjectId)),
        resourceLink: record.resourceId
          ? relativeLink(path, requiredPath(paths.resources, record.resourceId))
          : undefined,
        topicLink: record.topicId
          ? relativeLink(path, requiredPath(paths.topics, record.topicId))
          : undefined
      };
      if (existing) {
        return Schema2EntityDocumentCodec.updateRecord(
          existing.document,
          record,
          options
        ).toString();
      }
      return Schema2EntityDocumentCodec.renderRecord(
        new StudyRecord(
          record.id,
          record.subjectId,
          record.activity,
          record.resourceId,
          record.topicId,
          record.quantity,
          record.unit,
          record.correctAnswers,
          record.completed,
          record.notes ?? `${record.activity}${index > 0 ? ` ${index + 1}` : ""}`
        ),
        options
      );
    }
  };
}

function planPaths(
  data: LeifPluginData,
  currentById: ReadonlyMap<string, IndexedSchema2Document>
): PlannedPaths {
  const used = new Set<string>();
  const contests = new Map<string, string>();
  const murals = new Map<string, string>();
  const subjects = new Map<string, string>();
  const topics = new Map<string, string>();
  const resources = new Map<string, string>();
  const sessions = new Map<string, string>();
  const records = new Map<string, string>();

  ordered(data.contests, (contest) => contest.name).forEach((contest) => {
    const root = dirname(
      reuseOrAllocate(
        currentById,
        contest.id,
        `Leif/concursos/${slugify(contest.name)}/concurso.md`,
        used
      )
    );
    contests.set(contest.id, `${root}/concurso.md`);
    murals.set(contest.id, `${root}/mural.md`);
  });

  ordered(
    data.subjects,
    (subject) => `${subject.contestId}|${subject.order}|${subject.name}`
  ).forEach((subject) => {
    const contestRoot = dirname(requiredPath(contests, subject.contestId));
    subjects.set(
      subject.id,
      reuseOrAllocate(
        currentById,
        subject.id,
        `${contestRoot}/materias/${slugify(subject.name)}/materia.md`,
        used
      )
    );
  });

  ordered(data.topics, (topic) => `${topic.subjectId}|${topic.name}`).forEach((topic) => {
    const subjectRoot = dirname(requiredPath(subjects, topic.subjectId));
    topics.set(
      topic.id,
      reuseOrAllocate(
        currentById,
        topic.id,
        `${subjectRoot}/assuntos/${slugify(topic.name)}/assunto.md`,
        used
      )
    );
  });

  ordered(
    data.resources,
    (resource) => `${resource.subjectId}|${resource.order}|${resource.title}`
  ).forEach((resource) => {
    const subjectRoot = dirname(requiredPath(subjects, resource.subjectId));
    resources.set(
      resource.id,
      reuseOrAllocate(
        currentById,
        resource.id,
        `${subjectRoot}/recursos/${slugify(resource.title)}/recurso.md`,
        used
      )
    );
  });

  ordered(
    data.studySessions,
    (session) => `${session.contestId}|${session.date}|${session.startTime ?? ""}|${session.id}`
  ).forEach((session) => {
    const contestRoot = dirname(requiredPath(contests, session.contestId));
    const sessionSlug = slugify(`${session.date}-${session.startTime ?? session.id}`);
    sessions.set(
      session.id,
      reuseOrAllocate(
        currentById,
        session.id,
        `${contestRoot}/sessoes/${session.date.slice(0, 7)}/${sessionSlug}/sessao.md`,
        used
      )
    );
    session.records.forEach((record, index) => {
      const title = record.notes ?? record.activity;
      records.set(
        record.id,
        reuseOrAllocate(
          currentById,
          record.id,
          `${dirname(requiredPath(sessions, session.id))}/registros/${slugify(index > 0 ? `${title}-${index + 1}` : title)}.md`,
          used
        )
      );
    });
  });

  return { contests, murals, subjects, topics, resources, sessions, records };
}

function reuseOrAllocate(
  currentById: ReadonlyMap<string, IndexedSchema2Document>,
  id: string,
  desiredPath: string,
  used: Set<string>
): string {
  const existing = currentById.get(id)?.path;
  if (existing) {
    used.add(existing);
    return existing;
  }
  return allocatePath(desiredPath, used);
}

function allocatePath(path: string, used: Set<string>): string {
  const normalized = normalizePath(path);
  if (!used.has(normalized)) {
    used.add(normalized);
    return normalized;
  }
  const extension = normalized.endsWith(".md") ? ".md" : "";
  const stem = extension ? normalized.slice(0, -extension.length) : normalized;
  let suffix = 2;
  while (used.has(`${stem}-${suffix}${extension}`)) suffix += 1;
  const allocated = `${stem}-${suffix}${extension}`;
  used.add(allocated);
  return allocated;
}

function relativeLink(fromFile: string, toFile: string): string {
  const fromParts = dirname(fromFile).split("/").filter(Boolean);
  const toParts = stripMarkdownExtension(toFile).split("/").filter(Boolean);
  let shared = 0;
  while (fromParts[shared] === toParts[shared]) shared += 1;
  const up = fromParts.slice(shared).map(() => "..");
  return [...up, ...toParts.slice(shared)].join("/") || stripMarkdownExtension(basename(toFile));
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "sem-titulo";
}

function sortChanges(changes: Schema2FileChange[]): Schema2FileChange[] {
  const order = { delete: 0, create: 1, update: 2 };
  return [...changes].sort((left, right) => order[left.kind] - order[right.kind]);
}

function ordered<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((left, right) => key(left).localeCompare(key(right)));
}

function requiredPath(paths: ReadonlyMap<string, string>, id: string): string {
  const path = paths.get(id);
  if (!path) throw new Error(`No schema-2 path planned for ${id}.`);
  return path;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function dirname(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function stripMarkdownExtension(path: string): string {
  return path.endsWith(".md") ? path.slice(0, -3) : path;
}
