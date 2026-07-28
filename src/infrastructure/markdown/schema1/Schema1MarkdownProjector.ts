import { Contest, type ContestExamPlan } from "@/domain/entities/Contest";
import { ImportedProgress } from "@/domain/entities/ImportedProgress";
import { Mural, MuralSubjectSnapshot } from "@/domain/entities/Mural";
import { Resource } from "@/domain/entities/Resource";
import { ResourceAccess } from "@/domain/entities/ResourceAccess";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { StudySession } from "@/domain/entities/StudySession";
import { Subject } from "@/domain/entities/Subject";
import { Topic } from "@/domain/entities/Topic";
import { GoalUnit } from "@/domain/types/GoalUnit";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";

export interface Schema1MarkdownFile {
  path: string;
  content: string;
}

interface Schema1Document {
  id: string;
  type: string;
  title: string;
  properties: ReadonlyMap<string, string>;
  content: string;
}

interface ProjectedSchema1StudyData extends Pick<
  LeifPluginData,
  "contests" | "cycleStates" | "subjects" | "topics" | "resources" | "studySessions"
> {}

export interface Schema1ProjectOptions {
  sessionIdForRecord?: (recordId: string) => string;
}

const REGION_MARKER = (name: string) =>
  new RegExp(`<!-- leif:${name}:start -->([\\s\\S]*?)<!-- leif:${name}:end -->`, "m");
const REFERENCE_WITH_BLOCK_ID = /^\s*(?:[-*]|\d+\.)\s+.*\^leif-ref-([a-fA-F0-9]+)\s*$/;

export class Schema1MarkdownProjector {
  static project(
    files: readonly Schema1MarkdownFile[],
    options: Schema1ProjectOptions = {}
  ): ProjectedSchema1StudyData {
    const documents = files.map((file) => parseSchema1Document(file.content));
    const byId = new Map(documents.map((document) => [document.id, document]));
    const contests = documents
      .filter((document) => document.type === "concurso")
      .map((document) => decodeContest(document, documents));
    const subjects = documents
      .filter((document) => document.type === "materia")
      .map((document) => decodeSubject(document, byId));
    const topics = documents
      .filter((document) => document.type === "assunto")
      .map((document) => decodeTopic(document));
    const itemResources = documents
      .filter((document) => document.type === "item")
      .map((document) => decodeResource(document, byId, documents));
    const topicResources = decodeTopicResources(documents, byId, subjects, itemResources);
    const notebookResources = decodeNotebookResources(documents, subjects, [
      ...itemResources,
      ...topicResources
    ]);
    const resources = [...itemResources, ...topicResources, ...notebookResources];
    const studySessions = documents
      .filter((document) => document.type === "registro")
      .map((document) => decodeStudySession(document, options))
      .filter((session): session is StudySession => session !== null);

    return {
      contests,
      cycleStates: [],
      subjects,
      topics,
      resources,
      studySessions
    };
  }
}

function parseSchema1Document(content: string): Schema1Document {
  const properties = parseFrontmatter(content);
  return {
    id: required(properties, "leif-id"),
    type: required(properties, "leif-type"),
    title: parseTitle(content),
    properties,
    content
  };
}

function decodeContest(document: Schema1Document, documents: readonly Schema1Document[]): Contest {
  return new Contest(
    document.id,
    document.title,
    readReferenceIds(document, "subjects"),
    decodeMural(document, documents),
    decodeExamPlan(document)
  );
}

function decodeSubject(
  document: Schema1Document,
  documentsById: ReadonlyMap<string, Schema1Document>
): Subject {
  const contestId =
    optional(document, "contest-id") ??
    [...documentsById.values()].find(
      (candidate) =>
        candidate.type === "concurso" &&
        readReferenceIds(candidate, "subjects").includes(document.id)
    )?.id ??
    "";
  return new Subject(
    document.id,
    contestId,
    document.title,
    1,
    parseBoolean(optional(document, "active"), true),
    parseNumber(optional(document, "planned-minutes")) ?? 0,
    optional(document, "stage"),
    readReferenceIds(document, "items"),
    readReferenceIds(document, "topics")
  );
}

function decodeTopic(document: Schema1Document): Topic {
  return new Topic(document.id, required(document.properties, "subject-id"), document.title);
}

function decodeResource(
  document: Schema1Document,
  documentsById: ReadonlyMap<string, Schema1Document>,
  documents: readonly Schema1Document[]
): Resource {
  const subjectId =
    optional(document, "subject-id") ??
    [...documentsById.values()].find(
      (candidate) =>
        candidate.type === "materia" && readReferenceIds(candidate, "items").includes(document.id)
    )?.id ??
    "";
  const totalPages = parseNumber(optional(document, "total-pages"));
  const questionCount = parseNumber(optional(document, "question-count"));
  const goal =
    totalPages !== undefined
      ? new ResourceGoal(totalPages, "paginas")
      : questionCount !== undefined
        ? new ResourceGoal(questionCount, "questoes")
        : undefined;
  const format =
    totalPages !== undefined ? "pdf" : questionCount !== undefined ? "questoes" : "outro";
  const subject = [...documentsById.values()].find(
    (candidate) => candidate.type === "materia" && candidate.id === subjectId
  );
  const order = subject ? readReferenceIds(subject, "items").indexOf(document.id) : -1;

  return new Resource(
    document.id,
    subjectId,
    document.title,
    order >= 0 ? order + 1 : 1,
    format,
    goal,
    false,
    [],
    decodeAccesses(document, documents)
  );
}

function decodeAccesses(
  owner: Schema1Document,
  documents: readonly Schema1Document[]
): ResourceAccess[] {
  const candidates = documents.filter(
    (document) => document.type === "recurso" && optional(document, "owner-id") === owner.id
  );
  const byId = new Map(candidates.map((document) => [document.id, document]));
  const orderedIds = readReferenceIds(owner, "resources");
  const ordered = [
    ...orderedIds
      .map((id) => byId.get(id))
      .filter((document): document is Schema1Document => !!document),
    ...candidates.filter((document) => !orderedIds.includes(document.id))
  ];

  return ordered.map((document) => decodeAccessDocument(document));
}

function decodeTopicResources(
  documents: readonly Schema1Document[],
  documentsById: ReadonlyMap<string, Schema1Document>,
  subjects: Subject[],
  existingResources: readonly Resource[]
): Resource[] {
  const topicResourceDocuments = documents.filter((document) => {
    const owner = documentsById.get(optional(document, "owner-id") ?? "");
    return document.type === "recurso" && owner?.type === "assunto";
  });
  const result: Resource[] = [];

  documents
    .filter((document) => document.type === "assunto")
    .forEach((topic) => {
      const subjectId = required(topic.properties, "subject-id");
      const byId = new Map(
        topicResourceDocuments
          .filter((document) => optional(document, "owner-id") === topic.id)
          .map((document) => [document.id, document])
      );
      const orderedIds = readReferenceIds(topic, "resources");
      const ordered = [
        ...orderedIds
          .map((id) => byId.get(id))
          .filter((document): document is Schema1Document => !!document),
        ...[...byId.values()].filter((document) => !orderedIds.includes(document.id))
      ];

      ordered.forEach((document) => {
        result.push(
          new Resource(
            document.id,
            subjectId,
            optional(document, "title") ?? document.title,
            nextResourceOrder([...existingResources, ...result], subjectId),
            legacyReferenceFormat(optional(document, "resource-type")),
            undefined,
            false,
            [topic.id],
            [decodeAccessDocument(document)]
          )
        );
        appendSubjectResource(subjects, subjectId, document.id);
      });
    });

  return result;
}

function decodeNotebookResources(
  documents: readonly Schema1Document[],
  subjects: Subject[],
  existingResources: readonly Resource[]
): Resource[] {
  const result: Resource[] = [];

  documents
    .filter((document) => document.type === "assunto" && optional(document, "notebook-id"))
    .forEach((topic) => {
      const subjectId = required(topic.properties, "subject-id");
      const title = required(topic.properties, "notebook-name");
      const resourceId = required(topic.properties, "notebook-id");
      const solvedQuestions = parseNumber(optional(topic, "notebook-solved")) ?? 0;
      const correctAnswers = parseNumber(optional(topic, "notebook-correct"));
      result.push(
        new Resource(
          resourceId,
          subjectId,
          title,
          nextResourceOrder([...existingResources, ...result], subjectId),
          "questoes",
          undefined,
          false,
          [topic.id],
          [
            new ResourceAccess(
              title,
              required(topic.properties, "notebook-url"),
              optional(topic, "notebook-notes")
            )
          ],
          new ImportedProgress(solvedQuestions, correctAnswers)
        )
      );
      appendSubjectResource(subjects, subjectId, resourceId);
    });

  return result;
}

function decodeAccessDocument(document: Schema1Document): ResourceAccess {
  return new ResourceAccess(
    optional(document, "title") ?? document.title,
    required(document.properties, "url"),
    optional(document, "notes")
  );
}

function decodeStudySession(
  document: Schema1Document,
  options: Schema1ProjectOptions
): StudySession | null {
  const subjectId = optional(document, "subject-id");
  if (!subjectId) {
    return null;
  }
  const type = optional(document, "type");
  const quantity = parseNumber(optional(document, "count"));
  const record = new StudyRecord(
    document.id,
    subjectId,
    legacyActivity(type),
    optional(document, "item-id"),
    optional(document, "topic-id"),
    quantity,
    quantity !== undefined ? legacySessionUnit(type) : undefined,
    parseNumber(optional(document, "correct")),
    parseBoolean(optional(document, "completed"), false),
    legacyNotes(document)
  );

  return new StudySession(
    options.sessionIdForRecord?.(document.id) ?? `session-${document.id}`,
    required(document.properties, "contest-id"),
    (optional(document, "studied-at") ?? "1970-01-01").slice(0, 10),
    [record]
  );
}

function decodeExamPlan(document: Schema1Document): ContestExamPlan | undefined {
  const examPlan: ContestExamPlan = {
    examDate: optional(document, "exam-date"),
    board: optional(document, "board"),
    weeklyStudyHours: parseNumber(optional(document, "weekly-study-hours")),
    weeklyQuestionGoal: parseNumber(optional(document, "weekly-question-goal"))
  };
  return Object.values(examPlan).some((value) => value !== undefined) ? examPlan : undefined;
}

function decodeMural(contest: Schema1Document, documents: readonly Schema1Document[]): Mural {
  const links = documents
    .filter(
      (document) =>
        document.type === "mural-link" && optional(document, "contest-id") === contest.id
    )
    .map(
      (document) =>
        `[${optional(document, "label") ?? document.title}](${required(document.properties, "url")})`
    );
  const notes = [readRegion(contest, "wall-notes").trim() || undefined, ...links]
    .filter((value): value is string => Boolean(value))
    .join("\n");
  const snapshots = documents
    .filter(
      (document) =>
        document.type === "mural-snapshot" && optional(document, "contest-id") === contest.id
    )
    .map(
      (document) =>
        new MuralSubjectSnapshot(
          required(document.properties, "subject-id"),
          parseNumber(optional(document, "weight")),
          parseNumber(optional(document, "score")),
          readReferenceIds(document, "target-items")
        )
    );

  return new Mural(notes || undefined, snapshots);
}

function legacyNotes(document: Schema1Document): string | undefined {
  const notes = [
    optional(document, "phase") ? `Fase: ${optional(document, "phase")}` : undefined,
    optional(document, "reference") ? `Referência: ${optional(document, "reference")}` : undefined,
    optional(document, "notes")
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
  return notes || undefined;
}

function legacyActivity(type: string | undefined): string {
  if (type === "pdf") return "leitura";
  if (type === "questions") return "questoes";
  if (type === "video") return "video";
  return type ?? "outro";
}

function legacySessionUnit(type: string | undefined): GoalUnit {
  if (type === "questions") return GoalUnit.QUESTOES;
  if (type === "video") return GoalUnit.MINUTOS;
  return GoalUnit.PAGINAS;
}

function legacyReferenceFormat(type: string | undefined): string {
  if (type === "pdf" || type === "video" || type === "link") return type;
  return type ?? "link";
}

function readReferenceIds(document: Schema1Document, regionName: string): string[] {
  return readRegion(document, regionName)
    .split(/\r?\n/)
    .map((line) => line.match(REFERENCE_WITH_BLOCK_ID)?.[1])
    .filter((hex): hex is string => hex !== undefined)
    .map(hexDecode);
}

function readRegion(document: Schema1Document, regionName: string): string {
  return document.content.match(REGION_MARKER(regionName))?.[1] ?? "";
}

function parseFrontmatter(content: string): Map<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const properties = new Map<string, string>();
  match?.[1].split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) return;
    properties.set(line.slice(0, separator).trim(), unquote(line.slice(separator + 1).trim()));
  });
  return properties;
}

function parseTitle(content: string): string {
  return content.match(/^#\s+(.+)$/m)?.[1].trim() ?? "";
}

function required(properties: ReadonlyMap<string, string>, key: string): string {
  const value = properties.get(key);
  if (!value) throw new Error(`Schema 1 property "${key}" is required.`);
  return value;
}

function optional(document: Schema1Document, key: string): string | undefined {
  const value = document.properties.get(key)?.trim();
  return value ? value : undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true";
}

function appendSubjectResource(subjects: Subject[], subjectId: string, resourceId: string): void {
  const subject = subjects.find((candidate) => candidate.id === subjectId);
  if (subject && !subject.resourceIds.includes(resourceId)) {
    subject.resourceIds.push(resourceId);
  }
}

function nextResourceOrder(resources: readonly Resource[], subjectId: string): number {
  return (
    resources
      .filter((resource) => resource.subjectId === subjectId)
      .reduce((max, resource) => Math.max(max, resource.order), 0) + 1
  );
}

function hexDecode(hex: string): string {
  return (
    hex
      .match(/.{1,2}/g)
      ?.map((pair) => String.fromCharCode(Number.parseInt(pair, 16)))
      .join("") ?? ""
  );
}

function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}
