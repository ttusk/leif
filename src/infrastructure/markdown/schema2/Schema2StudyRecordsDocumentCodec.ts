import type { StudyRecord } from "@/domain/entities/StudyRecord";
import { Schema2Document } from "./Schema2Document";

export interface MonthlyStudyRecordRenderEntry {
  record: StudyRecord;
  subjectName: string;
  subjectLink: string;
  resourceLink?: string;
  topicLink?: string;
}

const MONTH_DOCUMENT_KEYS = new Set(["mes"]);

export class Schema2StudyRecordsDocumentCodec {
  static render(
    id: string,
    month: string,
    entries: readonly MonthlyStudyRecordRenderEntry[]
  ): string {
    return [
      "---",
      "leif-type: registros",
      "leif-schema: 2",
      `leif-id: ${id}`,
      `mes: ${month}`,
      "---",
      "",
      `# Registros — ${month}`,
      "",
      "<!-- leif:registros:start -->",
      renderEntries(entries),
      "<!-- leif:registros:end -->",
      ""
    ].join("\n");
  }

  static update(
    document: Schema2Document,
    month: string,
    entries: readonly MonthlyStudyRecordRenderEntry[]
  ): string {
    return document
      .replaceProperties(new Map([["mes", month]]), MONTH_DOCUMENT_KEYS)
      .replaceRegion("registros", renderEntries(entries))
      .toString();
  }
}

function renderEntries(entries: readonly MonthlyStudyRecordRenderEntry[]): string {
  return entries
    .map(({ record, subjectName, subjectLink, resourceLink, topicLink }) =>
      [
        `## ${record.date} · ${subjectName}`,
        "",
        `leif-id:: ${record.id}`,
        `data:: ${record.date}`,
        `materia:: [[${subjectLink}]]`,
        resourceLink ? `recurso:: [[${resourceLink}]]` : undefined,
        topicLink ? `assunto:: [[${topicLink}]]` : undefined,
        record.quantity !== undefined ? `quantidade:: ${record.quantity}` : undefined,
        record.unit !== undefined ? `unidade:: ${record.unit}` : undefined,
        record.correctAnswers !== undefined ? `acertos:: ${record.correctAnswers}` : undefined,
        `concluido:: ${record.completed}`,
        record.notes !== undefined ? `notas:: ${JSON.stringify(record.notes)}` : undefined
      ]
        .filter((line): line is string => line !== undefined)
        .join("\n")
    )
    .join("\n\n");
}
