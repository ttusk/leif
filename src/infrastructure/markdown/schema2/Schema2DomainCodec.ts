import { Contest, type ContestExamPlan } from "@/domain/entities/Contest";
import { CycleState } from "@/domain/entities/CycleState";
import { ImportedProgress } from "@/domain/entities/ImportedProgress";
import { Mural } from "@/domain/entities/Mural";
import { Resource } from "@/domain/entities/Resource";
import { ResourceAccess } from "@/domain/entities/ResourceAccess";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { StudySession } from "@/domain/entities/StudySession";
import { Subject } from "@/domain/entities/Subject";
import { Topic } from "@/domain/entities/Topic";
import { isGoalUnit, type GoalUnit } from "@/domain/types/GoalUnit";
import { Schema2DocumentError, parseWikiLinkList } from "./Schema2Document";
import type { IndexedSchema2Document } from "./Schema2WorkspaceIndex";
import { Schema2WorkspaceIndex } from "./Schema2WorkspaceIndex";

export type Schema2DomainCodecErrorCode =
  "missing-parent" | "invalid-property" | "invalid-link-target" | "cross-subject-link";

export class Schema2DomainCodecError extends Error {
  constructor(
    public readonly code: Schema2DomainCodecErrorCode,
    message: string
  ) {
    super(message);
    this.name = "Schema2DomainCodecError";
  }
}

export interface DecodedSchema2Domain {
  contests: Contest[];
  cycleStates: CycleState[];
  subjects: Subject[];
  topics: Topic[];
  resources: Resource[];
  studySessions: StudySession[];
}

interface DecodeContext {
  index: Schema2WorkspaceIndex;
  subjectOrderById: ReadonlyMap<string, number>;
  subjectIdsByContestId: ReadonlyMap<string, string[]>;
  topicOrderById: ReadonlyMap<string, number>;
  topicIdsBySubjectId: ReadonlyMap<string, string[]>;
  resourceOrderById: ReadonlyMap<string, number>;
  resourceIdsBySubjectId: ReadonlyMap<string, string[]>;
}

const ACCESS_LINK = /^\s*(?:[-*]|\d+\.)\s+\[([^\]]+)\]\(([^)]+)\)\s*$/;

export class Schema2DomainCodec {
  static decode(index: Schema2WorkspaceIndex): DecodedSchema2Domain {
    const context = buildDecodeContext(index);
    return {
      contests: index.contests.map((contest) => decodeContest(contest, context)),
      cycleStates: index.contests.flatMap((contest) => decodeCycleState(contest, context)),
      subjects: index.subjects.map((subject) => decodeSubject(subject, context)),
      topics: index.topics.map(decodeTopic),
      resources: index.resources.map((resource) => decodeResource(resource, context)),
      studySessions: index.sessions.map((session) => decodeSession(session, context))
    };
  }
}

function buildDecodeContext(index: Schema2WorkspaceIndex): DecodeContext {
  const subjectOrderById = new Map<string, number>();
  const subjectIdsByContestId = new Map<string, string[]>();
  const topicOrderById = new Map<string, number>();
  const topicIdsBySubjectId = new Map<string, string[]>();
  const resourceOrderById = new Map<string, number>();
  const resourceIdsBySubjectId = new Map<string, string[]>();

  index.contests.forEach((contest) => {
    const linkedSubjects = readResolvedRegion(index, contest, "materias", "materia");
    const ordered = mergeLinkedAndContained(
      linkedSubjects.map((subject) => subject.id),
      index.subjects
        .filter((subject) => subject.contestId === contest.id)
        .map((subject) => subject.id)
    );
    subjectIdsByContestId.set(contest.id, ordered);
    ordered.forEach((subjectId, index) => subjectOrderById.set(subjectId, index + 1));
  });

  index.subjects.forEach((subject) => {
    const linkedTopics = readResolvedRegion(index, subject, "assuntos", "assunto");
    const orderedTopics = mergeLinkedAndContained(
      linkedTopics.map((topic) => {
        assertSameSubject(subject.id, subject.id, topic.id);
        return topic.id;
      }),
      index.topics.filter((topic) => topic.subjectId === subject.id).map((topic) => topic.id)
    );
    topicIdsBySubjectId.set(subject.id, orderedTopics);
    orderedTopics.forEach((topicId, index) => topicOrderById.set(topicId, index + 1));

    const linkedResources = readResolvedRegion(index, subject, "recursos", "recurso");
    const orderedResources = mergeLinkedAndContained(
      linkedResources.map((resource) => resource.id),
      index.resources
        .filter((resource) => resource.subjectId === subject.id)
        .map((resource) => resource.id)
    );
    resourceIdsBySubjectId.set(subject.id, orderedResources);
    orderedResources.forEach((resourceId, index) => resourceOrderById.set(resourceId, index + 1));
  });

  return {
    index,
    subjectOrderById,
    subjectIdsByContestId,
    topicOrderById,
    topicIdsBySubjectId,
    resourceOrderById,
    resourceIdsBySubjectId
  };
}

function decodeContest(contest: IndexedSchema2Document, context: DecodeContext): Contest {
  return new Contest(
    contest.id,
    contest.title,
    context.subjectIdsByContestId.get(contest.id) ?? [],
    decodeMural(contest.id, context),
    decodeExamPlan(contest)
  );
}

function decodeCycleState(contest: IndexedSchema2Document, context: DecodeContext): CycleState[] {
  const subject = resolveOptionalPropertyLink(context.index, contest, "materia-atual", "materia");
  const resource = resolveOptionalPropertyLink(context.index, contest, "recurso-atual", "recurso");
  if (!subject && !resource) return [];

  if (subject && requiredParent(subject, "contestId") !== contest.id) {
    throw new Schema2DomainCodecError(
      "invalid-link-target",
      `Current subject "${subject.id}" must belong to contest "${contest.id}".`
    );
  }
  if (resource) {
    const resourceSubjectId = requiredParent(resource, "subjectId");
    if (subject && resourceSubjectId !== subject.id) {
      throw new Schema2DomainCodecError(
        "cross-subject-link",
        `Current resource "${resource.id}" must belong to the current subject.`
      );
    }
    return [new CycleState(contest.id, subject?.id ?? resourceSubjectId, resource.id)];
  }

  if (!subject) return [];
  return [new CycleState(contest.id, subject.id, null)];
}

function decodeSubject(subject: IndexedSchema2Document, context: DecodeContext): Subject {
  const contestId = requiredParent(subject, "contestId");
  return new Subject(
    subject.id,
    contestId,
    subject.title,
    context.subjectOrderById.get(subject.id) ?? 1,
    parseBoolean(subject, "ativa", true),
    parseOptionalNumber(subject, "minutos-planejados") ?? 0,
    optionalProperty(subject, "etapa"),
    context.resourceIdsBySubjectId.get(subject.id) ?? [],
    context.topicIdsBySubjectId.get(subject.id) ?? []
  );
}

function decodeTopic(topic: IndexedSchema2Document): Topic {
  return new Topic(topic.id, requiredParent(topic, "subjectId"), topic.title);
}

function decodeResource(resource: IndexedSchema2Document, context: DecodeContext): Resource {
  const subjectId = requiredParent(resource, "subjectId");
  const topicIds = readResolvedRegion(context.index, resource, "assuntos", "assunto").map(
    (topic) => {
      assertSameSubject(subjectId, requiredParent(topic, "subjectId"), topic.id);
      return topic.id;
    }
  );

  return new Resource(
    resource.id,
    subjectId,
    resource.title,
    context.resourceOrderById.get(resource.id) ?? 1,
    optionalProperty(resource, "formato"),
    decodeResourceGoal(resource),
    parseBoolean(resource, "concluido", false),
    topicIds,
    parseAccesses(readOptionalRegion(resource, "acessos")),
    decodeImportedProgress(resource)
  );
}

function decodeSession(session: IndexedSchema2Document, context: DecodeContext): StudySession {
  const contestId = requiredParent(session, "contestId");
  const records = readResolvedRegion(context.index, session, "registros", "registro").map(
    (record) => {
      const sessionId = requiredParent(record, "sessionId");
      if (sessionId !== session.id) {
        throw new Schema2DomainCodecError(
          "invalid-link-target",
          `Record "${record.id}" must belong to session "${session.id}".`
        );
      }
      return decodeRecord(record, context);
    }
  );

  return new StudySession(
    session.id,
    contestId,
    requiredProperty(session, "data"),
    records,
    optionalProperty(session, "inicio"),
    optionalProperty(session, "fim")
  );
}

function decodeRecord(record: IndexedSchema2Document, context: DecodeContext): StudyRecord {
  const subject = resolvePropertyLink(context.index, record, "materia", "materia");
  const resource = resolveOptionalPropertyLink(context.index, record, "recurso", "recurso");
  const topic = resolveOptionalPropertyLink(context.index, record, "assunto", "assunto");

  if (resource) {
    assertSameSubject(subject.id, requiredParent(resource, "subjectId"), resource.id);
  }
  if (topic) {
    assertSameSubject(subject.id, requiredParent(topic, "subjectId"), topic.id);
  }

  return new StudyRecord(
    record.id,
    subject.id,
    requiredProperty(record, "atividade"),
    resource?.id,
    topic?.id,
    parseOptionalNumber(record, "quantidade"),
    parseOptionalGoalUnit(record, "unidade"),
    parseOptionalNumber(record, "acertos"),
    parseBoolean(record, "concluido", false)
  );
}

function decodeMural(contestId: string, context: DecodeContext): Mural {
  const mural = context.index.murals.find((mural) => mural.contestId === contestId);
  return new Mural(mural ? bodyAfterH1(mural).trim() || undefined : undefined);
}

function decodeExamPlan(contest: IndexedSchema2Document): ContestExamPlan | undefined {
  const examPlan: ContestExamPlan = {
    examDate: optionalProperty(contest, "data-prova"),
    board: optionalProperty(contest, "banca"),
    weeklyStudyHours: parseOptionalNumber(contest, "horas-semanais"),
    weeklyQuestionGoal: parseOptionalNumber(contest, "meta-questoes-semanal")
  };
  return Object.values(examPlan).some((value) => value !== undefined) ? examPlan : undefined;
}

function decodeResourceGoal(resource: IndexedSchema2Document): ResourceGoal | undefined {
  const amount = parseOptionalNumber(resource, "meta");
  const unit = parseOptionalGoalUnit(resource, "unidade");
  if (amount === undefined && unit === undefined) return undefined;
  if (amount === undefined || unit === undefined) {
    throw new Schema2DomainCodecError(
      "invalid-property",
      `Resource "${resource.id}" must define meta and unidade together.`
    );
  }
  return new ResourceGoal(amount, unit);
}

function decodeImportedProgress(resource: IndexedSchema2Document): ImportedProgress | undefined {
  const quantity = parseOptionalNumber(resource, "progresso-importado");
  const correctAnswers = parseOptionalNumber(resource, "acertos-importados");
  if (quantity === undefined && correctAnswers === undefined) return undefined;
  if (quantity === undefined) {
    throw new Schema2DomainCodecError(
      "invalid-property",
      `Resource "${resource.id}" must define progresso-importado before acertos-importados.`
    );
  }
  return new ImportedProgress(quantity, correctAnswers);
}

function readResolvedRegion(
  index: Schema2WorkspaceIndex,
  source: IndexedSchema2Document,
  regionName: string,
  expectedType: string
): IndexedSchema2Document[] {
  return parseWikiLinkList(readOptionalRegion(source, regionName)).map((link) => {
    const resolved = index.resolveWikiLink(source.path, link.target);
    if (resolved.type !== expectedType) {
      throw new Schema2DomainCodecError(
        "invalid-link-target",
        `Wikilink "${link.target}" in ${source.path} must point to ${expectedType}.`
      );
    }
    return resolved;
  });
}

function resolvePropertyLink(
  index: Schema2WorkspaceIndex,
  source: IndexedSchema2Document,
  property: string,
  expectedType: string
): IndexedSchema2Document {
  const target = requiredWikiLinkProperty(source, property);
  const resolved = index.resolveWikiLink(source.path, target);
  if (resolved.type !== expectedType) {
    throw new Schema2DomainCodecError(
      "invalid-link-target",
      `Property "${property}" in ${source.path} must point to ${expectedType}.`
    );
  }
  return resolved;
}

function resolveOptionalPropertyLink(
  index: Schema2WorkspaceIndex,
  source: IndexedSchema2Document,
  property: string,
  expectedType: string
): IndexedSchema2Document | undefined {
  if (source.document.property(property) === undefined) return undefined;
  return resolvePropertyLink(index, source, property, expectedType);
}

function parseAccesses(source: string): ResourceAccess[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.match(ACCESS_LINK))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => new ResourceAccess(match[1], match[2]));
}

function mergeLinkedAndContained(linked: string[], contained: string[]): string[] {
  return [...linked, ...contained.filter((id) => !linked.includes(id))];
}

function parseBoolean(
  document: IndexedSchema2Document,
  property: string,
  defaultValue: boolean
): boolean {
  const value = document.document.property(property);
  if (value === undefined || value === "") return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Schema2DomainCodecError(
    "invalid-property",
    `Property "${property}" in ${document.path} must be true or false.`
  );
}

function parseOptionalNumber(
  document: IndexedSchema2Document,
  property: string
): number | undefined {
  const value = optionalProperty(document, property);
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Schema2DomainCodecError(
      "invalid-property",
      `Property "${property}" in ${document.path} must be a number.`
    );
  }
  return number;
}

function parseOptionalGoalUnit(
  document: IndexedSchema2Document,
  property: string
): GoalUnit | undefined {
  const value = optionalProperty(document, property);
  if (value === undefined) return undefined;
  if (!isGoalUnit(value)) {
    throw new Schema2DomainCodecError(
      "invalid-property",
      `Property "${property}" in ${document.path} must be a known goal unit.`
    );
  }
  return value;
}

function optionalProperty(document: IndexedSchema2Document, property: string): string | undefined {
  const value = document.document.property(property)?.trim();
  return value ? value : undefined;
}

function requiredProperty(document: IndexedSchema2Document, property: string): string {
  const value = optionalProperty(document, property);
  if (!value) {
    throw new Schema2DomainCodecError(
      "invalid-property",
      `Property "${property}" in ${document.path} is required.`
    );
  }
  return value;
}

function requiredWikiLinkProperty(document: IndexedSchema2Document, property: string): string {
  const value = unwrapObsidianQuotedWikiLink(requiredProperty(document, property));
  const match = value.match(/^\[\[([^\]]+)\]\]$/);
  if (!match) {
    throw new Schema2DomainCodecError(
      "invalid-property",
      `Property "${property}" in ${document.path} must be a wikilink.`
    );
  }
  return match[1].split("|")[0].split("#")[0].trim();
}

function unwrapObsidianQuotedWikiLink(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : value;
  } catch {
    return value;
  }
}

function requiredParent(document: IndexedSchema2Document, property: string): string {
  const value = (document as unknown as Record<string, unknown>)[property];
  if (typeof value === "string" && value.trim()) return value;
  throw new Schema2DomainCodecError(
    "missing-parent",
    `Document "${document.path}" is missing inferred ${property}.`
  );
}

function assertSameSubject(
  expectedSubjectId: string,
  actualSubjectId: string,
  linkedId: string
): void {
  if (actualSubjectId !== expectedSubjectId) {
    throw new Schema2DomainCodecError(
      "cross-subject-link",
      `Linked document "${linkedId}" must belong to the same subject.`
    );
  }
}

function readOptionalRegion(document: IndexedSchema2Document, regionName: string): string {
  try {
    return document.document.readRegion(regionName);
  } catch (error) {
    if (error instanceof Schema2DocumentError && error.code === "missing-region") return "";
    throw error;
  }
}

function bodyAfterH1(document: IndexedSchema2Document): string {
  const source = document.document.toString();
  const match = source.match(/^#\s+.+$(?:\r?\n)?([\s\S]*)/m);
  return match?.[1] ?? "";
}
