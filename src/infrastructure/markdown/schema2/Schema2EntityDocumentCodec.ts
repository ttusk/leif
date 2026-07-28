import type { Contest } from "@/domain/entities/Contest";
import type { Mural } from "@/domain/entities/Mural";
import type { Resource } from "@/domain/entities/Resource";
import type { ResourceAccess } from "@/domain/entities/ResourceAccess";
import type { Subject } from "@/domain/entities/Subject";
import type { Topic } from "@/domain/entities/Topic";
import { Schema2Document, type WikiLink, renderWikiLinkList } from "./Schema2Document";

interface ContestRenderOptions {
  subjectLinks: readonly WikiLink[];
  currentSubjectLink?: string;
  currentResourceLink?: string;
}

interface SubjectRenderOptions {
  topicLinks: readonly WikiLink[];
  resourceLinks: readonly WikiLink[];
}

interface ResourceRenderOptions {
  topicLinks: readonly WikiLink[];
}

const CONTEST_MANAGED_KEYS = new Set([
  "data-prova",
  "banca",
  "horas-semanais",
  "meta-questoes-semanal",
  "materia-atual",
  "recurso-atual"
]);
const SUBJECT_MANAGED_KEYS = new Set(["ativa", "minutos-planejados", "etapa"]);
const RESOURCE_MANAGED_KEYS = new Set([
  "formato",
  "meta",
  "unidade",
  "concluido",
  "progresso-importado",
  "acertos-importados"
]);

export class Schema2EntityDocumentCodec {
  static renderContest(contest: Contest, options: ContestRenderOptions): string {
    return [
      renderFrontmatter("concurso", contest.id, [
        ["data-prova", contest.examPlan?.examDate],
        ["banca", contest.examPlan?.board],
        ["horas-semanais", contest.examPlan?.weeklyStudyHours],
        ["meta-questoes-semanal", contest.examPlan?.weeklyQuestionGoal],
        ["materia-atual", renderWikiLinkProperty(options.currentSubjectLink)],
        ["recurso-atual", renderWikiLinkProperty(options.currentResourceLink)]
      ]),
      renderTitle(contest.name),
      "## Ordem do ciclo",
      "",
      "<!-- leif:materias:start -->",
      renderWikiLinkList(options.subjectLinks),
      "<!-- leif:materias:end -->",
      ""
    ].join("\n");
  }

  static updateContest(
    document: Schema2Document,
    contest: Contest,
    options: ContestRenderOptions
  ): Schema2Document {
    return document
      .replaceTitle(contest.name)
      .replaceProperties(
        new Map([
          ["data-prova", contest.examPlan?.examDate],
          ["banca", contest.examPlan?.board],
          ["horas-semanais", renderOptionalScalar(contest.examPlan?.weeklyStudyHours)],
          ["meta-questoes-semanal", renderOptionalScalar(contest.examPlan?.weeklyQuestionGoal)],
          ["materia-atual", renderWikiLinkProperty(options.currentSubjectLink)],
          ["recurso-atual", renderWikiLinkProperty(options.currentResourceLink)]
        ]),
        CONTEST_MANAGED_KEYS
      )
      .replaceRegion("materias", renderWikiLinkList(options.subjectLinks));
  }

  static renderSubject(subject: Subject, options: SubjectRenderOptions): string {
    return [
      renderFrontmatter("materia", subject.id, [
        ["ativa", subject.isActive],
        ["minutos-planejados", subject.plannedStudyMinutes],
        ["etapa", subject.currentStage]
      ]),
      renderTitle(subject.name),
      "## Assuntos",
      "",
      "<!-- leif:assuntos:start -->",
      renderWikiLinkList(options.topicLinks),
      "<!-- leif:assuntos:end -->",
      "",
      "## Recursos",
      "",
      "<!-- leif:recursos:start -->",
      renderWikiLinkList(options.resourceLinks),
      "<!-- leif:recursos:end -->",
      ""
    ].join("\n");
  }

  static updateSubject(
    document: Schema2Document,
    subject: Subject,
    options: SubjectRenderOptions
  ): Schema2Document {
    return document
      .replaceTitle(subject.name)
      .replaceProperties(
        new Map([
          ["ativa", renderScalar(subject.isActive)],
          ["minutos-planejados", renderScalar(subject.plannedStudyMinutes)],
          ["etapa", subject.currentStage]
        ]),
        SUBJECT_MANAGED_KEYS
      )
      .replaceRegion("assuntos", renderWikiLinkList(options.topicLinks))
      .replaceRegion("recursos", renderWikiLinkList(options.resourceLinks));
  }

  static renderTopic(topic: Topic): string {
    return [renderFrontmatter("assunto", topic.id), renderTitle(topic.name)].join("\n");
  }

  static updateTopic(document: Schema2Document, topic: Topic): Schema2Document {
    return document.replaceTitle(topic.name);
  }

  static renderResource(resource: Resource, options: ResourceRenderOptions): string {
    return [
      renderFrontmatter("recurso", resource.id, [
        ["formato", resource.format],
        ["meta", resource.goal?.amount],
        ["unidade", resource.goal?.unit],
        ["concluido", resource.completed],
        ["progresso-importado", resource.baseline?.quantity],
        ["acertos-importados", resource.baseline?.correctAnswers]
      ]),
      renderTitle(resource.title),
      "## Assuntos",
      "",
      "<!-- leif:assuntos:start -->",
      renderWikiLinkList(options.topicLinks, false),
      "<!-- leif:assuntos:end -->",
      "",
      "## Acessos",
      "",
      "<!-- leif:acessos:start -->",
      renderAccesses(resource.accesses),
      "<!-- leif:acessos:end -->",
      ""
    ].join("\n");
  }

  static updateResource(
    document: Schema2Document,
    resource: Resource,
    options: ResourceRenderOptions
  ): Schema2Document {
    return document
      .replaceTitle(resource.title)
      .replaceProperties(
        new Map([
          ["formato", resource.format],
          ["meta", renderOptionalScalar(resource.goal?.amount)],
          ["unidade", resource.goal?.unit],
          ["concluido", renderScalar(resource.completed)],
          ["progresso-importado", renderOptionalScalar(resource.baseline?.quantity)],
          ["acertos-importados", renderOptionalScalar(resource.baseline?.correctAnswers)]
        ]),
        RESOURCE_MANAGED_KEYS
      )
      .replaceRegion("assuntos", renderWikiLinkList(options.topicLinks, false))
      .replaceRegion("acessos", renderAccesses(resource.accesses));
  }

  static renderMural(id: string, mural: Mural): string {
    return [renderFrontmatter("mural", id), renderTitle("Mural"), mural.notes ?? "", ""].join("\n");
  }

  static updateMural(document: Schema2Document, mural: Mural): Schema2Document {
    const source = document.toString();
    const match = source.match(/^#\s+.+$(?:\r?\n)?/m);
    if (!match || match.index === undefined) return document;
    const head = source.slice(0, match.index + match[0].length);
    return Schema2Document.parse(`${head}${mural.notes ?? ""}${mural.notes ? "\n" : ""}`);
  }
}

function renderFrontmatter(
  type: string,
  id: string,
  properties: readonly (readonly [string, string | number | boolean | undefined])[] = []
): string {
  return [
    "---",
    `leif-type: ${type}`,
    "leif-schema: 2",
    `leif-id: ${id}`,
    ...properties
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${renderScalar(value)}`),
    "---",
    ""
  ].join("\n");
}

function renderTitle(title: string): string {
  return `# ${title}\n`;
}

function renderAccesses(accesses: readonly ResourceAccess[]): string {
  return accesses.map((access) => `- [${access.title}](${access.url})`).join("\n");
}

function renderWikiLinkProperty(target: string | undefined): string | undefined {
  return target ? `[[${target}]]` : undefined;
}

function renderOptionalScalar(value: string | number | boolean | undefined): string | undefined {
  return value === undefined ? undefined : renderScalar(value);
}

function renderScalar(value: string | number | boolean | undefined): string {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === undefined) return "";
  if (/^\[\[[^\]]+\]\]$/.test(value)) return JSON.stringify(value);
  if (/^(?:true|false|-?\d+(?:\.\d+)?)$/.test(value)) return JSON.stringify(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{2}:\d{2}$/.test(value)) return JSON.stringify(value);
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : JSON.stringify(value);
}
