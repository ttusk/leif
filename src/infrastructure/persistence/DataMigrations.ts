import { Contest, type ContestExamPlan } from "@/domain/entities/Contest";
import { CycleState } from "@/domain/entities/CycleState";
import { ImportedProgress } from "@/domain/entities/ImportedProgress";
import { Mural, MuralSubjectSnapshot } from "@/domain/entities/Mural";
import { Resource } from "@/domain/entities/Resource";
import { ResourceAccess } from "@/domain/entities/ResourceAccess";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { Subject } from "@/domain/entities/Subject";
import { Topic } from "@/domain/entities/Topic";
import { GoalUnit } from "@/domain/types/GoalUnit";
import {
  createDefaultLeifPluginData,
  LEIF_DATA_SCHEMA_VERSION,
  type LeifPluginData
} from "@/domain/types/LeifPluginData";

interface LegacyContest {
  id: string;
  name: string;
  subjectIds?: string[];
  wall?: {
    notes?: string;
    noticeLinks?: Array<{ title: string; url: string }>;
    examLinks?: Array<{ title: string; url: string }>;
    subjectSnapshots?: Array<{
      subjectId: string;
      weight?: number;
      score?: number;
      targetItems?: string[];
      targetResources?: string[];
    }>;
  };
  examPlan?: ContestExamPlan;
}

interface LegacySubject {
  id: string;
  contestId: string;
  name: string;
  order: number;
  isActive?: boolean;
  plannedStudyMinutes?: number;
  currentStage?: string;
  itemIds?: string[];
  resourceIds?: string[];
  topicIds?: string[];
}

interface LegacyTopic {
  id: string;
  subjectId: string;
  name: string;
  resourceReferences?: LegacyResourceReference[];
  questionNotebook?: {
    id?: string;
    name: string;
    url: string;
    solvedQuestions?: number;
    correctAnswers?: number;
    notes?: string;
  };
}

interface LegacyStudyItem {
  id: string;
  subjectId: string;
  title: string;
  order: number;
  totalPages?: number;
  questionCount?: number;
  completed?: boolean;
  resourceReferences?: LegacyResourceReference[];
}

interface LegacyResourceReference {
  id?: string;
  title?: string;
  name?: string;
  url: string;
  type?: string;
  notes?: string;
}

interface LegacyStudySession {
  id: string;
  contestId: string;
  subjectId?: string;
  studyItemId?: string;
  topicId?: string;
  type?: string;
  studiedAt?: string;
  date?: string;
  phase?: string;
  reference?: string;
  pagesOrCount?: number;
  correctAnswers?: number;
  completed?: boolean;
  notes?: string;
}

interface LegacySessionRecord {
  id: string;
  subjectId: string;
  resourceId?: string;
  topicId?: string;
  quantity?: number;
  unit?: GoalUnit;
  correctAnswers?: number;
  completed?: boolean;
  notes?: string;
}

interface LegacySessionAggregate {
  id: string;
  contestId: string;
  date: string;
  records: LegacySessionRecord[];
  startTime?: string;
  endTime?: string;
  notes?: string;
}

interface LegacyCycleState {
  contestId: string;
  currentSubjectId?: string | null;
  currentItemId?: string | null;
  currentResourceId?: string | null;
}

interface LegacyData {
  schemaVersion?: number;
  activeContestId?: string | null;
  contests?: LegacyContest[];
  contestStates?: LegacyCycleState[];
  cycleStates?: LegacyCycleState[];
  subjects?: LegacySubject[];
  topics?: LegacyTopic[];
  studyItems?: LegacyStudyItem[];
  resources?: Resource[];
  studySessions?: Array<LegacyStudySession | LegacySessionAggregate>;
  studyRecords?: StudyRecord[];
  runtimeState?: LeifPluginData["runtimeState"];
}

export class UnsupportedSchemaVersionError extends Error {
  constructor(
    public readonly foundVersion: number,
    public readonly supportedVersion: number
  ) {
    super(
      `This data was created by a newer Leif version (schema ${foundVersion}); ` +
        `this version supports schema ${supportedVersion}. Open it read-only or update Leif.`
    );
    this.name = "UnsupportedSchemaVersionError";
  }
}

export class DataMigrationService {
  private readonly CURRENT_VERSION = LEIF_DATA_SCHEMA_VERSION;

  migrate(data: LeifPluginData): LeifPluginData {
    const legacy = data as unknown as LegacyData;
    const version = legacy.schemaVersion ?? 1;
    if (version > this.CURRENT_VERSION) {
      throw new UnsupportedSchemaVersionError(version, this.CURRENT_VERSION);
    }
    if (version >= this.CURRENT_VERSION && !legacy.studyItems && !legacy.contestStates) {
      return normalizeCurrentData(legacy);
    }
    return projectLegacyData(legacy);
  }

  getCurrentVersion(): number {
    return this.CURRENT_VERSION;
  }
}

function projectLegacyData(data: LegacyData): LeifPluginData {
  const defaults = createDefaultLeifPluginData();
  const resources: Resource[] = [];
  const notebookResourceByTopic = new Map<string, string>();

  const contests = collection(data.contests).map(
    (contest) =>
      new Contest(
        contest.id,
        contest.name,
        relationIds(contest.subjectIds),
        muralFromLegacy(contest.wall),
        contest.examPlan
      )
  );

  const subjects = normalizeOrdersByParent(
    collection(data.subjects),
    (subject) => subject.contestId
  ).map(
    (subject) =>
      new Subject(
        subject.id,
        subject.contestId,
        subject.name,
        subject.order,
        subject.isActive ?? true,
        subject.plannedStudyMinutes ?? 0,
        subject.currentStage,
        relationIds(subject.resourceIds ?? subject.itemIds),
        relationIds(subject.topicIds)
      )
  );

  const topics = collection(data.topics).map((topic) => {
    const resourceReferences = collection(topic.resourceReferences);
    resourceReferences.forEach((reference, index) => {
      const resourceId = reference.id ?? `${topic.id}-access-${index + 1}`;
      resources.push(
        new Resource(
          resourceId,
          topic.subjectId,
          reference.title ?? reference.name ?? reference.url,
          nextResourceOrder(resources, topic.subjectId),
          legacyReferenceFormat(reference.type),
          undefined,
          false,
          [topic.id],
          [
            new ResourceAccess(
              reference.title ?? reference.name ?? reference.url,
              reference.url,
              reference.notes
            )
          ]
        )
      );
      appendSubjectResource(subjects, topic.subjectId, resourceId);
    });

    if (topic.questionNotebook) {
      const notebook = topic.questionNotebook;
      const baseResourceId = notebook.id ?? `${topic.id}-notebook`;
      const resourceId = uniqueResourceIdForSubject(resources, baseResourceId, topic.subjectId);
      notebookResourceByTopic.set(topic.id, resourceId);
      const existing = resources.find(
        (resource) => resource.id === resourceId && resource.subjectId === topic.subjectId
      );
      if (existing) {
        if (!existing.topicIds.includes(topic.id)) existing.topicIds.push(topic.id);
      } else {
        resources.push(
          new Resource(
            resourceId,
            topic.subjectId,
            notebook.name,
            nextResourceOrder(resources, topic.subjectId),
            "questoes",
            undefined,
            false,
            [topic.id],
            [new ResourceAccess(notebook.name, notebook.url, notebook.notes)],
            new ImportedProgress(notebook.solvedQuestions ?? 0, notebook.correctAnswers ?? 0)
          )
        );
      }
      appendSubjectResource(subjects, topic.subjectId, resourceId);
    }

    return new Topic(topic.id, topic.subjectId, topic.name);
  });

  normalizeOrdersByParent(collection(data.studyItems), (item) => item.subjectId).forEach((item) => {
    const goal = legacyItemGoal(item);
    const resource = new Resource(
      item.id,
      item.subjectId,
      item.title,
      item.order,
      item.totalPages !== undefined
        ? "pdf"
        : item.questionCount !== undefined
          ? "questoes"
          : "outro",
      goal,
      item.completed ?? false,
      [],
      collection(item.resourceReferences).map(
        (reference) =>
          new ResourceAccess(
            reference.title ?? reference.name ?? reference.url,
            reference.url,
            reference.notes
          )
      )
    );
    resources.push(resource);
    appendSubjectResource(subjects, item.subjectId, item.id);
  });

  collection(data.resources).forEach((resource) => resources.push(resource));

  const studyRecords = [
    ...collection(data.studyRecords),
    ...collection(data.studySessions).flatMap((session) =>
      projectStudyRecords(session, notebookResourceByTopic)
    )
  ];

  return {
    ...defaults,
    schemaVersion: LEIF_DATA_SCHEMA_VERSION,
    activeContestId: data.activeContestId ?? null,
    contests,
    cycleStates: collection(data.cycleStates ?? data.contestStates).map(
      (state) =>
        new CycleState(
          state.contestId,
          state.currentSubjectId ?? null,
          state.currentResourceId ?? state.currentItemId ?? null
        )
    ),
    subjects,
    topics,
    resources,
    studyRecords,
    runtimeState: {
      ...defaults.runtimeState!,
      ...data.runtimeState
    }
  };
}

function normalizeCurrentData(data: LegacyData): LeifPluginData {
  const defaults = createDefaultLeifPluginData();
  return {
    ...defaults,
    ...(data as LeifPluginData),
    schemaVersion: LEIF_DATA_SCHEMA_VERSION,
    activeContestId: data.activeContestId ?? null,
    contests: collection(data.contests) as unknown as LeifPluginData["contests"],
    cycleStates: collection(data.cycleStates) as unknown as LeifPluginData["cycleStates"],
    subjects: collection(data.subjects) as unknown as LeifPluginData["subjects"],
    topics: collection(data.topics),
    resources: collection(data.resources),
    studyRecords: collection(data.studyRecords),
    runtimeState: {
      ...defaults.runtimeState!,
      ...data.runtimeState
    }
  };
}

function projectStudyRecords(
  session: LegacyStudySession | LegacySessionAggregate,
  notebookResourceByTopic: Map<string, string>
): StudyRecord[] {
  if ("records" in session) {
    return session.records.map(
      (record, index) =>
        new StudyRecord(
          record.id,
          session.contestId,
          session.date,
          record.subjectId,
          record.resourceId,
          record.topicId,
          record.quantity,
          record.unit,
          record.correctAnswers,
          record.completed ?? false,
          preserveLegacySessionMetadata(session, record.notes, index)
        )
    );
  }
  if (!session.subjectId) {
    return [];
  }
  const quantity = session.pagesOrCount;
  const unit = legacySessionUnit(session.type);
  const notes = [
    session.phase ? `Fase: ${session.phase}` : undefined,
    session.reference ? `Referência: ${session.reference}` : undefined,
    session.notes
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
  const resourceId =
    session.studyItemId ??
    (session.topicId ? notebookResourceByTopic.get(session.topicId) : undefined);
  const record = new StudyRecord(
    session.id,
    session.contestId,
    (session.studiedAt ?? session.date ?? "1970-01-01").slice(0, 10),
    session.subjectId,
    resourceId,
    session.topicId,
    quantity,
    quantity !== undefined ? unit : undefined,
    session.correctAnswers,
    session.completed ?? false,
    notes || undefined
  );
  return [record];
}

function preserveLegacySessionMetadata(
  session: LegacySessionAggregate,
  recordNotes: string | undefined,
  recordIndex: number
): string | undefined {
  if (recordIndex > 0) return recordNotes;
  const timing =
    session.startTime || session.endTime
      ? `Horário da antiga sessão: ${session.startTime ?? "?"}–${session.endTime ?? "?"}`
      : undefined;
  const sessionNotes = session.notes
    ? `Observações da antiga sessão:\n${session.notes}`
    : undefined;
  return (
    [recordNotes, timing, sessionNotes]
      .filter((value): value is string => Boolean(value))
      .join("\n\n") || undefined
  );
}

function muralFromLegacy(wall: LegacyContest["wall"]): Mural {
  const linkLines = [...collection(wall?.noticeLinks), ...collection(wall?.examLinks)].map(
    (link) => `[${link.title}](${link.url})`
  );
  const notes = [wall?.notes, ...linkLines].filter(Boolean).join("\n") || undefined;
  return new Mural(
    notes,
    collection(wall?.subjectSnapshots).map(
      (snapshot) =>
        new MuralSubjectSnapshot(
          snapshot.subjectId,
          snapshot.weight,
          snapshot.score,
          relationIds(snapshot.targetResources ?? snapshot.targetItems)
        )
    )
  );
}

function legacyItemGoal(item: LegacyStudyItem): ResourceGoal | undefined {
  if (item.totalPages !== undefined && item.totalPages > 0) {
    return new ResourceGoal(item.totalPages, GoalUnit.PAGINAS);
  }
  if (item.questionCount !== undefined && item.questionCount > 0) {
    return new ResourceGoal(item.questionCount, GoalUnit.QUESTOES);
  }
  return undefined;
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

function appendSubjectResource(subjects: Subject[], subjectId: string, resourceId: string): void {
  const subject = subjects.find((entry) => entry.id === subjectId);
  if (subject && !subject.resourceIds.includes(resourceId)) {
    subject.resourceIds.push(resourceId);
  }
}

function nextResourceOrder(resources: Resource[], subjectId: string): number {
  return (
    resources
      .filter((resource) => resource.subjectId === subjectId)
      .reduce((max, resource) => Math.max(max, resource.order), 0) + 1
  );
}

function uniqueResourceIdForSubject(
  resources: readonly Resource[],
  desiredId: string,
  subjectId: string
): string {
  const existing = resources.find((resource) => resource.id === desiredId);
  if (!existing || existing.subjectId === subjectId) return desiredId;

  const subjectScopedId = `${desiredId}-${subjectId}`;
  let candidate = subjectScopedId;
  let suffix = 2;
  while (resources.some((resource) => resource.id === candidate)) {
    candidate = `${subjectScopedId}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function collection<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function relationIds(value: string[] | undefined): string[] {
  return collection(value);
}

function normalizeOrdersByParent<T extends { order: number }>(
  items: T[],
  getParentKey: (item: T) => string
): T[] {
  const groups = new Map<string, Array<{ item: T; sourceIndex: number }>>();
  items.forEach((item, sourceIndex) => {
    const parentKey = getParentKey(item);
    groups.set(parentKey, [...(groups.get(parentKey) ?? []), { item, sourceIndex }]);
  });

  const normalizedOrders = new Map<T, number>();
  groups.forEach((group) => {
    group
      .sort(
        (left, right) => left.item.order - right.item.order || left.sourceIndex - right.sourceIndex
      )
      .forEach(({ item }, index) => normalizedOrders.set(item, index + 1));
  });

  return items.map((item) => ({ ...item, order: normalizedOrders.get(item) ?? 1 }));
}
