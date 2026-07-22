import { describe, expect, it } from "vitest";

import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import {
  MarkdownBundleError,
  MarkdownContestBundleCodec
} from "@/infrastructure/markdown/MarkdownContestBundleCodec";

function projection(): LeifPluginData {
  return {
    ...createDefaultLeifPluginData(),
    activeContestId: "contest-1",
    contests: [
      {
        id: "contest-1",
        name: "TRT 2ª Região",
        subjectIds: ["subject-2", "subject-1"],
        examPlan: {
          board: "FCC",
          examDate: "2026-10-18",
          weeklyStudyHours: 20,
          weeklyQuestionGoal: 500
        },
        wall: {
          noticeLinks: [{ id: "notice-1", label: "Edital", url: "https://example.com/e?a=1" }],
          examLinks: [{ id: "exam-1", label: "Prova", url: "https://example.com/prova" }],
          subjectSnapshots: [
            { subjectId: "subject-1", weight: 2, score: 80, targetItems: ["item-1"] }
          ],
          notes: "Revisar aos domingos."
        }
      }
    ],
    contestStates: [
      { contestId: "contest-1", currentSubjectId: "subject-2", currentItemId: "item-2" }
    ],
    subjects: [
      {
        id: "subject-1",
        contestId: "contest-1",
        name: "Português",
        order: 2,
        isActive: true,
        plannedStudyMinutes: 60,
        currentStage: "teoria",
        itemIds: ["item-1"],
        topicIds: ["topic-1"]
      },
      {
        id: "subject-2",
        contestId: "contest-1",
        name: "Constitucional",
        order: 1,
        isActive: false,
        plannedStudyMinutes: 45,
        itemIds: ["item-2"],
        topicIds: []
      }
    ],
    studyItems: [
      {
        id: "item-1",
        subjectId: "subject-1",
        title: "Sintaxe | período composto",
        order: 1,
        weight: 2,
        questionCount: 40,
        totalPages: 120,
        resourceReferences: [
          { id: "resource-1", title: "Aula 1", type: "pdf", url: "file.pdf", notes: "p. 1–20" }
        ]
      },
      { id: "item-2", subjectId: "subject-2", title: "Direitos fundamentais", order: 1 }
    ],
    topics: [
      {
        id: "topic-1",
        subjectId: "subject-1",
        name: "Orações subordinadas",
        resourceReferences: [],
        questionNotebook: {
          id: "notebook-1",
          name: "Caderno FCC",
          url: "https://tec.example/caderno",
          solvedQuestions: 30,
          correctAnswers: 24,
          notes: "refazer erros"
        }
      }
    ],
    studySessions: [
      {
        id: "session-1",
        contestId: "contest-1",
        type: "questions",
        studiedAt: "2026-07-21T20:00:00.000Z",
        subjectId: "subject-1",
        studyItemId: "item-1",
        topicId: "topic-1",
        phase: "revisão",
        reference: "Bloco 1",
        pagesOrCount: 20,
        correctAnswers: 16,
        completed: true
      }
    ]
  };
}

describe("MarkdownContestBundleCodec", () => {
  it("round-trips every durable contest field through ordinary Markdown files", () => {
    const codec = new MarkdownContestBundleCodec();
    const source = projection();

    const files = codec.encode(source, "contest-1");
    expect(files.length).toBeGreaterThan(5);
    expect(files.every((file) => file.path.endsWith(".md"))).toBe(true);
    expect(files.some((file) => file.path.includes("registros/2026-07"))).toBe(true);
    expect(files.map((file) => file.content).join("\n")).toContain("Sintaxe | período composto");

    const decoded = codec.decode(files);
    expect(decoded).toEqual({
      ...source,
      activeContestId: null,
      contestStates: [],
      runtimeState: createDefaultLeifPluginData().runtimeState
    });
  });

  it("takes subject and item order from managed-list position", () => {
    const codec = new MarkdownContestBundleCodec();
    const files = codec.encode(projection(), "contest-1");
    const contest = files.find((file) => file.path.endsWith("/concurso.md"))!;
    const lines = contest.content.split("\n");
    const references = lines.filter((line) => /^\d+\. \[\[/.test(line)).reverse();
    let referenceIndex = 0;
    contest.content = lines
      .map((line) => (/^\d+\. \[\[/.test(line) ? references[referenceIndex++] : line))
      .join("\n");

    const decoded = codec.decode(files);
    expect(decoded.contests[0].subjectIds).toEqual(["subject-1", "subject-2"]);
    expect(decoded.subjects.find((subject) => subject.id === "subject-1")?.order).toBe(1);
  });

  it("blocks duplicate identities across files", () => {
    const codec = new MarkdownContestBundleCodec();
    const files = codec.encode(projection(), "contest-1");
    files.push({ ...files[0], path: "Leif/concursos/copy/concurso.md" });

    expect(() => codec.decode(files)).toThrowError(
      expect.objectContaining<Partial<MarkdownBundleError>>({ code: "duplicate-id" })
    );
  });
});
