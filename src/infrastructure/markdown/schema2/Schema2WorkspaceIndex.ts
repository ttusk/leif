import { Schema2Document } from "./Schema2Document";

export type Schema2WorkspaceIndexErrorCode =
  "duplicate-id" | "unknown-source" | "missing-link-target" | "ambiguous-link";

export class Schema2WorkspaceIndexError extends Error {
  constructor(
    public readonly code: Schema2WorkspaceIndexErrorCode,
    message: string
  ) {
    super(message);
    this.name = "Schema2WorkspaceIndexError";
  }
}

export interface Schema2MarkdownFile {
  path: string;
  content: string;
}

export interface IndexedSchema2Document {
  id: string;
  type: string;
  title: string;
  path: string;
  document: Schema2Document;
}

export interface IndexedContest extends IndexedSchema2Document {
  type: "concurso";
}

export interface IndexedMural extends IndexedSchema2Document {
  type: "mural";
  contestId?: string;
}

export interface IndexedSubject extends IndexedSchema2Document {
  type: "materia";
  contestId?: string;
}

export interface IndexedTopic extends IndexedSchema2Document {
  type: "assunto";
  subjectId?: string;
}

export interface IndexedResource extends IndexedSchema2Document {
  type: "recurso";
  subjectId?: string;
}

export interface IndexedSession extends IndexedSchema2Document {
  type: "sessao";
  contestId?: string;
}

export interface IndexedStudyRecord extends IndexedSchema2Document {
  type: "registro";
  sessionId?: string;
}

export interface IndexedStudyRecordMonth extends IndexedSchema2Document {
  type: "registros";
  contestId?: string;
}

interface ParsedPath {
  contestSlug?: string;
  subjectSlug?: string;
  sessionMonth?: string;
  sessionSlug?: string;
}

const LEIF_CONTEST_ROOT = "Leif/concursos";
const CANONICAL_FILENAMES = [
  "concurso.md",
  "mural.md",
  "materia.md",
  "assunto.md",
  "recurso.md",
  "sessao.md"
];

export class Schema2WorkspaceIndex {
  private constructor(
    public readonly documents: readonly IndexedSchema2Document[],
    public readonly contests: readonly IndexedContest[],
    public readonly murals: readonly IndexedMural[],
    public readonly subjects: readonly IndexedSubject[],
    public readonly topics: readonly IndexedTopic[],
    public readonly resources: readonly IndexedResource[],
    public readonly sessions: readonly IndexedSession[],
    public readonly records: readonly IndexedStudyRecord[],
    public readonly recordMonths: readonly IndexedStudyRecordMonth[],
    private readonly documentsByPath: ReadonlyMap<string, IndexedSchema2Document>
  ) {}

  static build(files: readonly Schema2MarkdownFile[]): Schema2WorkspaceIndex {
    const documents = files.map((file) => indexDocument(file));
    const ids = new Map<string, IndexedSchema2Document>();
    documents.forEach((document) => {
      const duplicate = ids.get(document.id);
      if (duplicate) {
        throw new Schema2WorkspaceIndexError(
          "duplicate-id",
          `Duplicate leif-id "${document.id}" in ${duplicate.path} and ${document.path}.`
        );
      }
      ids.set(document.id, document);
    });

    const documentsByPath = new Map(documents.map((document) => [document.path, document]));
    const contests = documents.filter(isContest);
    const subjects = documents.filter(isSubject).map((document) => ({
      ...document,
      contestId: parentContestId(document.path, documentsByPath)
    }));
    const topics = documents.filter(isTopic).map((document) => ({
      ...document,
      subjectId: parentSubjectId(document.path, documentsByPath)
    }));
    const resources = documents.filter(isResource).map((document) => ({
      ...document,
      subjectId: parentSubjectId(document.path, documentsByPath)
    }));
    const sessions = documents.filter(isSession).map((document) => ({
      ...document,
      contestId: parentContestId(document.path, documentsByPath)
    }));
    const records = documents.filter(isStudyRecord).map((document) => ({
      ...document,
      sessionId: parentSessionId(document.path, documentsByPath)
    }));
    const recordMonths = documents.filter(isStudyRecordMonth).map((document) => ({
      ...document,
      contestId: parentContestId(document.path, documentsByPath)
    }));
    const murals = documents.filter(isMural).map((document) => ({
      ...document,
      contestId: parentContestId(document.path, documentsByPath)
    }));

    const enrichedDocuments = [
      ...contests,
      ...murals,
      ...subjects,
      ...topics,
      ...resources,
      ...sessions,
      ...records,
      ...recordMonths,
      ...documents.filter(
        (document) =>
          ![
            "concurso",
            "mural",
            "materia",
            "assunto",
            "recurso",
            "sessao",
            "registro",
            "registros"
          ].includes(document.type)
      )
    ];

    return new Schema2WorkspaceIndex(
      enrichedDocuments,
      contests,
      murals,
      subjects,
      topics,
      resources,
      sessions,
      records,
      recordMonths,
      new Map(enrichedDocuments.map((document) => [document.path, document]))
    );
  }

  resolveWikiLink(sourcePath: string, target: string): IndexedSchema2Document {
    const normalizedSourcePath = normalizePath(sourcePath);
    if (!this.documentsByPath.has(normalizedSourcePath)) {
      throw new Schema2WorkspaceIndexError(
        "unknown-source",
        `Cannot resolve wikilink from unknown source "${sourcePath}".`
      );
    }

    const linkTarget = stripAliasAndHeading(target);
    const direct = this.resolveDirectPath(normalizedSourcePath, linkTarget);
    if (direct) return direct;

    const suffixMatches = this.findSuffixMatches(linkTarget);
    if (suffixMatches.length === 1) return suffixMatches[0];
    if (suffixMatches.length > 1) {
      throw new Schema2WorkspaceIndexError(
        "ambiguous-link",
        `Ambiguous wikilink "${target}" matches multiple Leif documents.`
      );
    }

    throw new Schema2WorkspaceIndexError(
      "missing-link-target",
      `Wikilink "${target}" does not match a Leif document.`
    );
  }

  private resolveDirectPath(
    normalizedSourcePath: string,
    linkTarget: string
  ): IndexedSchema2Document | undefined {
    const basePath = linkTarget.startsWith("/")
      ? normalizePath(linkTarget.slice(1))
      : resolveRelativePath(dirname(normalizedSourcePath), linkTarget);
    return this.expandPathCandidates(basePath)
      .map((candidate) => this.documentsByPath.get(candidate))
      .find((document): document is IndexedSchema2Document => document !== undefined);
  }

  private expandPathCandidates(basePath: string): string[] {
    const normalized = normalizePath(basePath);
    if (normalized.endsWith(".md")) return [normalized];
    return [
      `${normalized}.md`,
      ...CANONICAL_FILENAMES.map((filename) => `${normalized}/${filename}`)
    ];
  }

  private findSuffixMatches(linkTarget: string): IndexedSchema2Document[] {
    const normalizedTarget = normalizePath(linkTarget).replace(/^\//, "");
    const targetCandidates = [
      normalizedTarget.endsWith(".md") ? normalizedTarget : `${normalizedTarget}.md`,
      ...CANONICAL_FILENAMES.map((filename) => `${normalizedTarget}/${filename}`)
    ];
    return this.documents.filter((document) =>
      targetCandidates.some(
        (candidate) => document.path === candidate || document.path.endsWith(`/${candidate}`)
      )
    );
  }
}

function indexDocument(file: Schema2MarkdownFile): IndexedSchema2Document {
  const document = Schema2Document.parse(file.content);
  return {
    id: document.identity.id,
    type: document.identity.type,
    title: document.title,
    path: normalizePath(file.path),
    document
  };
}

function parentContestId(
  path: string,
  documentsByPath: ReadonlyMap<string, IndexedSchema2Document>
): string | undefined {
  const parsed = parseCanonicalPath(path);
  if (!parsed.contestSlug) return undefined;
  return documentsByPath.get(`${LEIF_CONTEST_ROOT}/${parsed.contestSlug}/concurso.md`)?.id;
}

function parentSubjectId(
  path: string,
  documentsByPath: ReadonlyMap<string, IndexedSchema2Document>
): string | undefined {
  const parsed = parseCanonicalPath(path);
  if (!parsed.contestSlug || !parsed.subjectSlug) return undefined;
  return documentsByPath.get(
    `${LEIF_CONTEST_ROOT}/${parsed.contestSlug}/materias/${parsed.subjectSlug}/materia.md`
  )?.id;
}

function parentSessionId(
  path: string,
  documentsByPath: ReadonlyMap<string, IndexedSchema2Document>
): string | undefined {
  const parsed = parseCanonicalPath(path);
  if (!parsed.contestSlug || !parsed.sessionMonth || !parsed.sessionSlug) return undefined;
  return documentsByPath.get(
    `${LEIF_CONTEST_ROOT}/${parsed.contestSlug}/sessoes/${parsed.sessionMonth}/${parsed.sessionSlug}/sessao.md`
  )?.id;
}

function parseCanonicalPath(path: string): ParsedPath {
  const parts = normalizePath(path).split("/");
  if (parts[0] !== "Leif" || parts[1] !== "concursos" || !parts[2]) return {};

  const parsed: ParsedPath = { contestSlug: parts[2] };
  const subjectIndex = parts.indexOf("materias");
  if (subjectIndex >= 0 && parts[subjectIndex + 1]) {
    parsed.subjectSlug = parts[subjectIndex + 1];
  }
  const sessionIndex = parts.indexOf("sessoes");
  if (sessionIndex >= 0 && parts[sessionIndex + 1] && parts[sessionIndex + 2]) {
    parsed.sessionMonth = parts[sessionIndex + 1];
    parsed.sessionSlug = parts[sessionIndex + 2];
  }
  return parsed;
}

function normalizePath(path: string): string {
  const segments: string[] = [];
  path
    .replace(/\\/g, "/")
    .split("/")
    .forEach((segment) => {
      if (!segment || segment === ".") return;
      if (segment === "..") {
        segments.pop();
        return;
      }
      segments.push(segment);
    });
  return segments.join("/");
}

function resolveRelativePath(sourceDirectory: string, target: string): string {
  return normalizePath(`${sourceDirectory}/${target}`);
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index) : "";
}

function stripAliasAndHeading(target: string): string {
  return target.split("|")[0].split("#")[0].trim();
}

function isContest(document: IndexedSchema2Document): document is IndexedContest {
  return document.type === "concurso";
}

function isMural(document: IndexedSchema2Document): document is IndexedMural {
  return document.type === "mural";
}

function isSubject(document: IndexedSchema2Document): document is IndexedSubject {
  return document.type === "materia";
}

function isTopic(document: IndexedSchema2Document): document is IndexedTopic {
  return document.type === "assunto";
}

function isResource(document: IndexedSchema2Document): document is IndexedResource {
  return document.type === "recurso";
}

function isSession(document: IndexedSchema2Document): document is IndexedSession {
  return document.type === "sessao";
}

function isStudyRecord(document: IndexedSchema2Document): document is IndexedStudyRecord {
  return document.type === "registro";
}

function isStudyRecordMonth(document: IndexedSchema2Document): document is IndexedStudyRecordMonth {
  return document.type === "registros";
}
