import type { ResourceReference } from "@/domain/entities/ResourceReference";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import { ManagedMarkdownDocument } from "@/infrastructure/markdown/ManagedMarkdownDocument";

export interface MarkdownFile {
  path: string;
  content: string;
}

export type MarkdownBundleErrorCode =
  "missing-contest" | "duplicate-id" | "missing-reference" | "invalid-property";

export class MarkdownBundleError extends Error {
  constructor(
    public readonly code: MarkdownBundleErrorCode,
    message: string,
    public readonly entityId?: string
  ) {
    super(message);
    this.name = "MarkdownBundleError";
  }
}

interface ParsedFile {
  file: MarkdownFile;
  document: ManagedMarkdownDocument;
}

/**
 * Converts a concurso projection into small, independently editable Markdown
 * documents. Relationships and order live in visible managed lists; scalar
 * fields live in flat Obsidian properties. No JSON payload is embedded.
 */
export class MarkdownContestBundleCodec {
  encode(data: LeifPluginData, contestId: string): MarkdownFile[] {
    const contest = data.contests.find((candidate) => candidate.id === contestId);
    if (!contest) {
      throw new MarkdownBundleError("missing-contest", `Contest "${contestId}" is missing.`);
    }

    const root = `Leif/concursos/${slug(contest.name)}-${shortId(contest.id)}`;
    const subjects = data.subjects.filter((subject) => subject.contestId === contestId);
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const orderedSubjectIds = contest.subjectIds.filter((id) => subjectById.has(id));
    const files: MarkdownFile[] = [];
    const subjectPaths = new Map(
      subjects.map((subject) => [
        subject.id,
        `${root}/materias/${slug(subject.name)}-${shortId(subject.id)}.md`
      ])
    );

    files.push({
      path: `${root}/concurso.md`,
      content: renderDocument(
        {
          "leif-type": "concurso",
          "leif-schema": 1,
          "leif-id": contest.id,
          name: contest.name,
          "exam-date": contest.examPlan?.examDate,
          board: contest.examPlan?.board,
          "weekly-study-hours": contest.examPlan?.weeklyStudyHours,
          "weekly-question-goal": contest.examPlan?.weeklyQuestionGoal
        },
        contest.name,
        [
          [
            "subjects",
            renderReferences(
              orderedSubjectIds,
              subjectPaths,
              new Map(subjects.map((subject) => [subject.id, subject.name])),
              root
            )
          ],
          ["wall-notes", contest.wall.notes ?? ""]
        ]
      )
    });

    contest.wall.noticeLinks.forEach((link) =>
      files.push(renderWallLink(root, contest.id, "notice", link))
    );
    contest.wall.examLinks.forEach((link) =>
      files.push(renderWallLink(root, contest.id, "exam", link))
    );
    contest.wall.subjectSnapshots.forEach((snapshot) => {
      files.push({
        path: `${root}/mural/snapshot-${shortId(snapshot.subjectId)}.md`,
        content: renderDocument(
          {
            "leif-type": "mural-snapshot",
            "leif-schema": 1,
            "leif-id": `snapshot-${contest.id}-${snapshot.subjectId}`,
            "contest-id": contest.id,
            "subject-id": snapshot.subjectId,
            weight: snapshot.weight,
            score: snapshot.score
          },
          `Snapshot — ${subjectById.get(snapshot.subjectId)?.name ?? snapshot.subjectId}`,
          [["target-items", renderBareReferences(snapshot.targetItems ?? [])]]
        )
      });
    });

    subjects.forEach((subject) => {
      const items = data.studyItems.filter((item) => item.subjectId === subject.id);
      const topics = data.topics.filter((topic) => topic.subjectId === subject.id);
      const itemPaths = new Map(
        items.map((item) => [item.id, `${root}/itens/${slug(item.title)}-${shortId(item.id)}.md`])
      );
      const topicPaths = new Map(
        topics.map((topic) => [
          topic.id,
          `${root}/assuntos/${slug(topic.name)}-${shortId(topic.id)}.md`
        ])
      );
      files.push({
        path: subjectPaths.get(subject.id)!,
        content: renderDocument(
          {
            "leif-type": "materia",
            "leif-schema": 1,
            "leif-id": subject.id,
            "contest-id": contest.id,
            name: subject.name,
            active: subject.isActive,
            "planned-minutes": subject.plannedStudyMinutes,
            stage: subject.currentStage
          },
          subject.name,
          [
            [
              "items",
              renderReferences(
                subject.itemIds,
                itemPaths,
                new Map(items.map((item) => [item.id, item.title])),
                root
              )
            ],
            [
              "topics",
              renderReferences(
                subject.topicIds,
                topicPaths,
                new Map(topics.map((topic) => [topic.id, topic.name])),
                root
              )
            ]
          ]
        )
      });

      items.forEach((item) => {
        const resources = item.resourceReferences ?? [];
        const resourcePaths = resourcePathMap(root, resources);
        files.push({
          path: itemPaths.get(item.id)!,
          content: renderDocument(
            {
              "leif-type": "item",
              "leif-schema": 1,
              "leif-id": item.id,
              "subject-id": subject.id,
              title: item.title,
              weight: item.weight,
              "question-count": item.questionCount,
              "total-pages": item.totalPages,
              "resources-defined": item.resourceReferences !== undefined
            },
            item.title,
            [
              [
                "resources",
                renderReferences(
                  resources.map((resource) => resource.id),
                  resourcePaths,
                  new Map(resources.map((resource) => [resource.id, resource.title])),
                  root
                )
              ]
            ]
          )
        });
        resources.forEach((resource) =>
          files.push(
            renderResource(root, resource, "item", item.id, resourcePaths.get(resource.id)!)
          )
        );
      });

      topics.forEach((topic) => {
        const resources = topic.resourceReferences;
        const resourcePaths = resourcePathMap(root, resources);
        files.push({
          path: topicPaths.get(topic.id)!,
          content: renderDocument(
            {
              "leif-type": "assunto",
              "leif-schema": 1,
              "leif-id": topic.id,
              "subject-id": subject.id,
              name: topic.name,
              "notebook-id": topic.questionNotebook?.id,
              "notebook-name": topic.questionNotebook?.name,
              "notebook-url": topic.questionNotebook?.url,
              "notebook-solved": topic.questionNotebook?.solvedQuestions,
              "notebook-correct": topic.questionNotebook?.correctAnswers,
              "notebook-notes": topic.questionNotebook?.notes
            },
            topic.name,
            [
              [
                "resources",
                renderReferences(
                  resources.map((resource) => resource.id),
                  resourcePaths,
                  new Map(resources.map((resource) => [resource.id, resource.title])),
                  root
                )
              ]
            ]
          )
        });
        resources.forEach((resource) =>
          files.push(
            renderResource(root, resource, "assunto", topic.id, resourcePaths.get(resource.id)!)
          )
        );
      });
    });

    data.studySessions
      .filter((session) => session.contestId === contestId)
      .forEach((session) => {
        const month = session.studiedAt.slice(0, 7);
        files.push({
          path: `${root}/registros/${month}/${slug(session.studiedAt)}-${shortId(session.id)}.md`,
          content: renderDocument(
            {
              "leif-type": "registro",
              "leif-schema": 1,
              "leif-id": session.id,
              "contest-id": contest.id,
              type: session.type,
              "studied-at": session.studiedAt,
              "subject-id": session.subjectId,
              "item-id": session.studyItemId,
              "topic-id": session.topicId,
              phase: session.phase,
              reference: session.reference,
              count: session.pagesOrCount,
              correct: session.correctAnswers,
              completed: session.completed
            },
            `Registro — ${session.studiedAt}`,
            []
          )
        });
      });

    return files;
  }

  decode(files: readonly MarkdownFile[]): LeifPluginData {
    const parsed = files.map((file) => ({
      file,
      document: ManagedMarkdownDocument.parse(file.content)
    }));
    assertUniqueIds(parsed);

    const contestFiles = byType(parsed, "concurso");
    if (contestFiles.length !== 1) {
      throw new MarkdownBundleError(
        "missing-contest",
        `Expected exactly one concurso document; found ${contestFiles.length}.`
      );
    }
    const contestFile = contestFiles[0];
    const contestId = contestFile.document.identity.id;
    const subjectIds = parseReferences(contestFile.document.readRegion("subjects"));
    const subjectOrder = new Map(subjectIds.map((id, index) => [id, index + 1]));
    const itemOrders = new Map<string, number>();
    const subjectItems = new Map<string, string[]>();
    const subjectTopics = new Map<string, string[]>();
    const ownerResources = new Map<string, string[]>();

    byType(parsed, "materia").forEach(({ document }) => {
      const itemIds = parseReferences(document.readRegion("items"));
      const topicIds = parseReferences(document.readRegion("topics"));
      subjectItems.set(document.identity.id, itemIds);
      subjectTopics.set(document.identity.id, topicIds);
      itemIds.forEach((id, index) => itemOrders.set(id, index + 1));
    });
    [...byType(parsed, "item"), ...byType(parsed, "assunto")].forEach(({ document }) => {
      ownerResources.set(document.identity.id, parseReferences(document.readRegion("resources")));
    });

    const resources = new Map(
      byType(parsed, "recurso").map(({ document }) => [
        document.identity.id,
        {
          id: document.identity.id,
          title: required(document, "title"),
          type: required(document, "resource-type") as ResourceReference["type"],
          url: optional(document, "url"),
          notes: optional(document, "notes")
        }
      ])
    );
    const resolveResources = (ownerId: string): ResourceReference[] =>
      (ownerResources.get(ownerId) ?? []).map((id) => {
        const resource = resources.get(id);
        if (!resource) {
          throw new MarkdownBundleError(
            "missing-reference",
            `Owner "${ownerId}" references missing resource "${id}".`,
            id
          );
        }
        return resource;
      });

    const wallLinks = byType(parsed, "mural-link");
    const snapshots = byType(parsed, "mural-snapshot");
    const result = createDefaultLeifPluginData();
    result.contests = [
      {
        id: contestId,
        name: required(contestFile.document, "name"),
        subjectIds,
        wall: {
          noticeLinks: wallLinks
            .filter(({ document }) => required(document, "kind") === "notice")
            .map(parseWallLink),
          examLinks: wallLinks
            .filter(({ document }) => required(document, "kind") === "exam")
            .map(parseWallLink),
          subjectSnapshots: snapshots.map(({ document }) => ({
            subjectId: required(document, "subject-id"),
            weight: optionalNumber(document, "weight"),
            score: optionalNumber(document, "score"),
            targetItems: parseReferences(document.readRegion("target-items"))
          })),
          notes: emptyToUndefined(contestFile.document.readRegion("wall-notes"))
        },
        examPlan: compactObject({
          examDate: optional(contestFile.document, "exam-date"),
          board: optional(contestFile.document, "board"),
          weeklyStudyHours: optionalNumber(contestFile.document, "weekly-study-hours"),
          weeklyQuestionGoal: optionalNumber(contestFile.document, "weekly-question-goal")
        })
      }
    ];
    result.subjects = byType(parsed, "materia").map(({ document }) => ({
      id: document.identity.id,
      contestId: required(document, "contest-id"),
      name: required(document, "name"),
      order: subjectOrder.get(document.identity.id) ?? missingOrder(document.identity.id),
      isActive: requiredBoolean(document, "active"),
      plannedStudyMinutes: requiredNumber(document, "planned-minutes"),
      currentStage: optional(document, "stage"),
      itemIds: subjectItems.get(document.identity.id) ?? [],
      topicIds: subjectTopics.get(document.identity.id) ?? []
    }));
    result.studyItems = byType(parsed, "item").map(({ document }) => ({
      id: document.identity.id,
      subjectId: required(document, "subject-id"),
      title: required(document, "title"),
      order: itemOrders.get(document.identity.id) ?? missingOrder(document.identity.id),
      weight: optionalNumber(document, "weight"),
      questionCount: optionalNumber(document, "question-count"),
      totalPages: optionalNumber(document, "total-pages"),
      resourceReferences: requiredBoolean(document, "resources-defined")
        ? resolveResources(document.identity.id)
        : undefined
    }));
    result.topics = byType(parsed, "assunto").map(({ document }) => {
      const notebookId = optional(document, "notebook-id");
      return {
        id: document.identity.id,
        subjectId: required(document, "subject-id"),
        name: required(document, "name"),
        resourceReferences: resolveResources(document.identity.id),
        questionNotebook: notebookId
          ? {
              id: notebookId,
              name: required(document, "notebook-name"),
              url: required(document, "notebook-url"),
              solvedQuestions: requiredNumber(document, "notebook-solved"),
              correctAnswers: requiredNumber(document, "notebook-correct"),
              notes: optional(document, "notebook-notes")
            }
          : undefined
      };
    });
    result.studySessions = byType(parsed, "registro").map(({ document }) => ({
      id: document.identity.id,
      contestId: required(document, "contest-id"),
      type: required(document, "type") as LeifPluginData["studySessions"][number]["type"],
      studiedAt: required(document, "studied-at"),
      subjectId: optional(document, "subject-id"),
      studyItemId: optional(document, "item-id"),
      topicId: optional(document, "topic-id"),
      phase: optional(document, "phase"),
      reference: optional(document, "reference"),
      pagesOrCount: optionalNumber(document, "count"),
      correctAnswers: optionalNumber(document, "correct"),
      completed: optionalBoolean(document, "completed")
    }));
    return result;
  }
}

type Scalar = string | number | boolean | undefined;

function renderDocument(
  properties: Record<string, Scalar>,
  title: string,
  regions: ReadonlyArray<readonly [string, string]>
): string {
  const propertyLines = Object.entries(properties)
    .filter((entry): entry is [string, Exclude<Scalar, undefined>] => entry[1] !== undefined)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? JSON.stringify(value) : value}`);
  const sections = regions.map(
    ([name, content]) =>
      `## ${humanize(name)}\n\n<!-- leif:${name}:start -->\n${content}\n<!-- leif:${name}:end -->`
  );
  return `---\n${propertyLines.join("\n")}\n---\n# ${title}\n${sections.length ? `\n${sections.join("\n\n")}` : ""}\n`;
}

function renderWallLink(
  root: string,
  contestId: string,
  kind: "notice" | "exam",
  link: { id: string; label: string; url: string }
): MarkdownFile {
  return {
    path: `${root}/mural/${kind}-${slug(link.label)}-${shortId(link.id)}.md`,
    content: renderDocument(
      {
        "leif-type": "mural-link",
        "leif-schema": 1,
        "leif-id": link.id,
        "contest-id": contestId,
        kind,
        label: link.label,
        url: link.url
      },
      link.label,
      []
    )
  };
}

function renderResource(
  root: string,
  resource: ResourceReference,
  ownerType: "item" | "assunto",
  ownerId: string,
  path: string
): MarkdownFile {
  return {
    path,
    content: renderDocument(
      {
        "leif-type": "recurso",
        "leif-schema": 1,
        "leif-id": resource.id,
        "owner-type": ownerType,
        "owner-id": ownerId,
        title: resource.title,
        "resource-type": resource.type,
        url: resource.url,
        notes: resource.notes
      },
      resource.title,
      []
    )
  };
}

function resourcePathMap(
  root: string,
  resources: readonly ResourceReference[]
): Map<string, string> {
  return new Map(
    resources.map((resource) => [
      resource.id,
      `${root}/recursos/${slug(resource.title)}-${shortId(resource.id)}.md`
    ])
  );
}

function renderReferences(
  ids: readonly string[],
  paths: ReadonlyMap<string, string>,
  labels: ReadonlyMap<string, string>,
  root: string
): string {
  return ids
    .map((id, index) => {
      const path = paths.get(id);
      if (!path) {
        throw new MarkdownBundleError(
          "missing-reference",
          `Cannot export missing referenced entity "${id}".`,
          id
        );
      }
      const relative = path.replace(`${root}/`, "").replace(/\.md$/, "");
      return `${index + 1}. [[${relative}|${escapeLinkLabel(labels.get(id) ?? id)}]] ^leif-ref-${hex(id)}`;
    })
    .join("\n");
}

function renderBareReferences(ids: readonly string[]): string {
  return ids.map((id, index) => `${index + 1}. ${id} ^leif-ref-${hex(id)}`).join("\n");
}

function parseReferences(content: string): string[] {
  if (!content.trim()) return [];
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const match = line.match(/\^leif-ref-([a-f0-9]+)\s*$/);
      if (!match) {
        throw new MarkdownBundleError(
          "invalid-property",
          `Managed reference is missing a stable block ID: ${line}`
        );
      }
      return unhex(match[1]);
    });
}

function assertUniqueIds(parsed: readonly ParsedFile[]): void {
  const seen = new Set<string>();
  parsed.forEach(({ document }) => {
    if (seen.has(document.identity.id)) {
      throw new MarkdownBundleError(
        "duplicate-id",
        `Identity "${document.identity.id}" appears in multiple files.`,
        document.identity.id
      );
    }
    seen.add(document.identity.id);
  });
}

function byType(parsed: readonly ParsedFile[], type: string): ParsedFile[] {
  return parsed.filter(({ document }) => document.identity.type === type);
}

function required(document: ManagedMarkdownDocument, name: string): string {
  const value = document.properties.get(name);
  if (value === undefined || value === "") {
    throw new MarkdownBundleError(
      "invalid-property",
      `Document "${document.identity.id}" requires property "${name}".`,
      document.identity.id
    );
  }
  return value;
}

function optional(document: ManagedMarkdownDocument, name: string): string | undefined {
  return emptyToUndefined(document.properties.get(name) ?? "");
}

function requiredNumber(document: ManagedMarkdownDocument, name: string): number {
  const value = Number(required(document, name));
  if (!Number.isFinite(value)) {
    throw new MarkdownBundleError("invalid-property", `Property "${name}" must be a number.`);
  }
  return value;
}

function optionalNumber(document: ManagedMarkdownDocument, name: string): number | undefined {
  const value = optional(document, name);
  return value === undefined ? undefined : requiredNumber(document, name);
}

function requiredBoolean(document: ManagedMarkdownDocument, name: string): boolean {
  const value = required(document, name);
  if (value !== "true" && value !== "false") {
    throw new MarkdownBundleError("invalid-property", `Property "${name}" must be true or false.`);
  }
  return value === "true";
}

function optionalBoolean(document: ManagedMarkdownDocument, name: string): boolean | undefined {
  return optional(document, name) === undefined ? undefined : requiredBoolean(document, name);
}

function parseWallLink({ document }: ParsedFile): { id: string; label: string; url: string } {
  return {
    id: document.identity.id,
    label: required(document, "label"),
    url: required(document, "url")
  };
}

function compactObject<T extends object>(value: T): T | undefined {
  return Object.values(value).some((candidate) => candidate !== undefined) ? value : undefined;
}

function missingOrder(id: string): never {
  throw new MarkdownBundleError(
    "missing-reference",
    `Ordered entity "${id}" is absent from its parent managed list.`,
    id
  );
}

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function slug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "sem-titulo"
  );
}

function shortId(id: string): string {
  return hex(id).slice(0, 8);
}

function hex(value: string): string {
  return Array.from(new TextEncoder().encode(value), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function unhex(value: string): string {
  const bytes = new Uint8Array(
    value.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []
  );
  return new TextDecoder().decode(bytes);
}

function escapeLinkLabel(value: string): string {
  return value.replace(/\|/g, "—").replace(/\]/g, "");
}

function humanize(value: string): string {
  return value.replace(/-/g, " ").replace(/^./, (character) => character.toUpperCase());
}
