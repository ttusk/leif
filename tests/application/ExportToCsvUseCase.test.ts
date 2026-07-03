import { describe, expect, it, vi } from "vitest";

import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { ExportToCsvUseCase } from "@/application/use-cases/ExportToCsvUseCase";
import { CsvExportService } from "@/domain/services/CsvExportService";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";

function createStore(initial: LeifPluginData = createDefaultLeifPluginData()): PluginDataStore {
  let data: LeifPluginData = initial;
  return {
    async load() {
      return data;
    },
    async save(next: LeifPluginData) {
      data = next;
    }
  };
}

describe("ExportToCsvUseCase", () => {
  it("exports sessions for the active contest with localized headers", async () => {
    const base = createDefaultLeifPluginData();
    const data: LeifPluginData = {
      ...base,
      activeContestId: "c1",
      subjects: [{ id: "s1", contestId: "c1", name: "Portuguese", order: 1, isActive: true, plannedStudyMinutes: 60, itemIds: [], topicIds: [] }],
      studySessions: [
        {
          id: "session-1",
          contestId: "c1",
          subjectId: "s1",
          type: "questions",
          studiedAt: "2026-06-11T20:00:00.000Z",
          pagesOrCount: 20,
          correctAnswers: 16,
          completed: true
        }
      ]
    };

    const spy = vi.spyOn(CsvExportService, "download").mockImplementation(() => {});
    const useCase = new ExportToCsvUseCase(createStore(data));

    await useCase.execute({ entityType: "sessions" });

    expect(spy).toHaveBeenCalledTimes(1);
    const [csv, filename] = spy.mock.calls[0];
    expect(filename).toBe("sessoes-c1");
    expect(csv).toContain("Data,Matéria,Assunto,Item,Tipo,Quantidade,Acertos,Concluído");
    expect(csv).toContain("Portuguese");
    expect(csv).toContain("questions");
  });

  it("exports contests with active flag", async () => {
    const base = createDefaultLeifPluginData();
    const data: LeifPluginData = {
      ...base,
      activeContestId: "c1",
      contests: [
        { id: "c1", name: "TRT", subjectIds: [], wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] } },
        { id: "c2", name: "SEFAZ", subjectIds: [], wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] } }
      ]
    };

    const spy = vi.spyOn(CsvExportService, "download").mockImplementation(() => {});
    const useCase = new ExportToCsvUseCase(createStore(data));

    await useCase.execute({ entityType: "contests" });

    const [csv, filename] = spy.mock.calls[0];
    expect(filename).toBe("concursos");
    expect(csv).toContain("ID,Nome,Notas,Links Edital,Links Prova,Snapshots Matérias,Ativo");
    expect(csv).toContain("c1,TRT");
    expect(csv).toContain("Sim");
    expect(csv).toContain("Não");
  });

  it("filters sessions by the provided contestId", async () => {
    const base = createDefaultLeifPluginData();
    const data: LeifPluginData = {
      ...base,
      studySessions: [
        { id: "a", contestId: "c1", subjectId: null, type: "pdf", studiedAt: "2026-06-11", pagesOrCount: 5, completed: true },
        { id: "b", contestId: "c2", subjectId: null, type: "pdf", studiedAt: "2026-06-11", pagesOrCount: 5, completed: true }
      ]
    };

    const spy = vi.spyOn(CsvExportService, "download").mockImplementation(() => {});
    const useCase = new ExportToCsvUseCase(createStore(data));

    await useCase.execute({ entityType: "sessions", contestId: "c2" });

    const [csv, filename] = spy.mock.calls[0];
    expect(filename).toBe("sessoes-c2");
    const dataRows = csv.split("\n").slice(1);
    expect(dataRows).toHaveLength(1);
  });
});
