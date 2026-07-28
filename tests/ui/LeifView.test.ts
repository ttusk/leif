// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PluginDataDiagnostic, PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { UpdateContestMuralUseCase } from "@/application/use-cases/UpdateContestMuralUseCase";
import { CreateResourceUseCase } from "@/application/use-cases/CreateResourceUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { CreateTopicUseCase } from "@/application/use-cases/CreateTopicUseCase";
import { CycleState } from "@/domain/entities/CycleState";
import { Resource } from "@/domain/entities/Resource";
import { ResourceAccess } from "@/domain/entities/ResourceAccess";
import { StudyRecord } from "@/domain/entities/StudyRecord";
import { Topic } from "@/domain/entities/Topic";
import { GoalUnit } from "@/domain/types/GoalUnit";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { LEIF_VIEW_TYPE, registerLeifView } from "@/ui/view/registerLeifView";
import {
  App,
  getOpenModals,
  getShownMenus,
  Plugin,
  resetOpenModals,
  resetShownMenus
} from "../mocks/obsidian";
import { MarkdownRenderer } from "obsidian";

class InMemoryPluginDataStore implements PluginDataStore {
  constructor(
    private data: LeifPluginData = createDefaultLeifPluginData(),
    private readonly currentDiagnostics: readonly PluginDataDiagnostic[] = []
  ) {}

  async load(): Promise<LeifPluginData> {
    return structuredClone(this.data);
  }

  async save(data: LeifPluginData): Promise<void> {
    this.data = structuredClone(data);
  }

  async mutate<T>(mutation: (draft: LeifPluginData) => T | Promise<T>): Promise<T> {
    const draft = structuredClone(this.data);
    const result = await mutation(draft);
    this.data = draft;
    return result;
  }

  diagnostics(): readonly PluginDataDiagnostic[] {
    return this.currentDiagnostics;
  }
}

async function seedUiData(dataStore: PluginDataStore): Promise<void> {
  const factory = new EntityRepositoryFactory(dataStore);
  const contest = await new CreateContestUseCase(dataStore, factory).execute({
    id: "contest-1",
    name: "TRT"
  });
  const subject = await new CreateSubjectUseCase(dataStore, factory).execute({
    id: "subject-1",
    contestId: contest.id,
    name: "Português",
    plannedStudyMinutes: 60
  });
  await new CreateResourceUseCase(dataStore, factory).execute({
    id: "resource-1",
    subjectId: subject.id,
    title: "PDF 01"
  });
}

async function seedUiCycleData(dataStore: PluginDataStore): Promise<void> {
  const factory = new EntityRepositoryFactory(dataStore);
  const contest = await new CreateContestUseCase(dataStore, factory).execute({
    id: "contest-1",
    name: "TRT"
  });
  const portuguese = await new CreateSubjectUseCase(dataStore, factory).execute({
    id: "subject-1",
    contestId: contest.id,
    name: "Português",
    plannedStudyMinutes: 60
  });
  const law = await new CreateSubjectUseCase(dataStore, factory).execute({
    id: "subject-2",
    contestId: contest.id,
    name: "Direito Constitucional",
    plannedStudyMinutes: 45
  });
  const administration = await new CreateSubjectUseCase(dataStore, factory).execute({
    id: "subject-3",
    contestId: contest.id,
    name: "Administração",
    plannedStudyMinutes: 40
  });
  await new CreateResourceUseCase(dataStore, factory).execute({
    id: "resource-1",
    subjectId: portuguese.id,
    title: "PDF 01"
  });
  await new CreateResourceUseCase(dataStore, factory).execute({
    id: "resource-2",
    subjectId: law.id,
    title: "Controle de constitucionalidade"
  });
  await new CreateResourceUseCase(dataStore, factory).execute({
    id: "resource-3",
    subjectId: administration.id,
    title: "Gestão pública"
  });
  await new CreateTopicUseCase(dataStore, factory).execute({
    id: "topic-2",
    subjectId: law.id,
    name: "Controle concentrado"
  });
  await dataStore.mutate((draft) => {
    draft.cycleStates = [new CycleState(contest.id, portuguese.id, "resource-1")];
  });
}

async function seedUiRecordHistory(dataStore: PluginDataStore): Promise<void> {
  await seedUiCycleData(dataStore);
  await dataStore.mutate((draft) => {
    draft.studyRecords.push(
      new StudyRecord(
        "record-1",
        "contest-1",
        "2026-07-27",
        "subject-1",
        "resource-1",
        undefined,
        12,
        GoalUnit.PAGINAS,
        undefined,
        true,
        "Leitura noturna"
      ),
      new StudyRecord(
        "record-2",
        "contest-1",
        "2026-07-27",
        "subject-2",
        "resource-2",
        "topic-2",
        20,
        GoalUnit.QUESTOES,
        16,
        true
      ),
      new StudyRecord(
        "record-3",
        "contest-1",
        "2026-07-20",
        "subject-1",
        "resource-1",
        undefined,
        30,
        GoalUnit.MINUTOS,
        undefined,
        true,
        "Revisão curta"
      )
    );
  });
}

async function openLeifView(dataStore: PluginDataStore) {
  const app = new App();
  const plugin = new Plugin(app);
  registerLeifView(plugin as never, dataStore);

  const openCommand = plugin.commands.find((command) => command.id === "open-view");
  if (!openCommand) throw new Error("Open view command was not registered.");
  await openCommand.callback();

  const leaf = app.workspace.getLeavesOfType(LEIF_VIEW_TYPE)[0];
  if (!leaf?.view) throw new Error("Leif view was not opened.");
  return { plugin, app, leaf, view: leaf.view };
}

describe("LeifView", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    resetOpenModals();
    resetShownMenus();
  });

  it("opens the dashboard for schema-3 study data", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);

    expect(leaf.view?.getViewType()).toBe(LEIF_VIEW_TYPE);
    expect(leaf.view?.contentEl.textContent).toContain("Hoje");
    expect(leaf.view?.contentEl.textContent).toContain("TRT");
    expect(leaf.view?.contentEl.textContent).toContain("Português");
    expect(leaf.view?.contentEl.textContent).toContain("PDF 01");
  });

  it("surfaces protected Markdown diagnostics without hiding the active concurso", async () => {
    const dataStore = new InMemoryPluginDataStore(createDefaultLeifPluginData(), [
      {
        path: "Leif/concursos/trt/concurso.md",
        code: "merge-conflict",
        message: "Resolva os marcadores de conflito antes de salvar."
      }
    ]);
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const diagnostic = leaf.view?.contentEl.querySelector(".leif-diagnostics");

    expect(diagnostic?.getAttribute("role")).toBe("alert");
    expect(diagnostic?.textContent).toContain("Leif protegeu seus dados");
    expect(diagnostic?.textContent).toContain("Leif/concursos/trt/concurso.md");
    expect(leaf.view?.contentEl.textContent).toContain("TRT");
  });

  it("opens the concurso switcher through an Obsidian native menu", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);
    await new CreateContestUseCase(dataStore, new EntityRepositoryFactory(dataStore)).execute({
      id: "contest-2",
      name: "INSS"
    });

    const { view } = await openLeifView(dataStore);
    view.contentEl
      .querySelector(".leif-contest-selector")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const [menu] = getShownMenus();
    expect(menu?.useNativeMenu).toBe(true);
    expect(menu?.items.map((item) => item.title)).toEqual(["TRT", "INSS", "Gerenciar concursos"]);
    expect(menu?.items[0]?.disabled).toBe(true);

    await (menu?.items[1]?.callback?.(new MouseEvent("click")) as Promise<void>);
    await vi.waitFor(async () => {
      expect((await dataStore.load()).activeContestId).toBe("contest-2");
    });
    expect(view.contentEl.querySelector(".leif-contest-selector")?.textContent).toContain("INSS");
    expect(view.contentEl.querySelector(".leif-contest-menu")).toBeNull();
  });

  it("renders concurso management as a readable table with native row actions", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { view } = await openLeifView(dataStore);
    view.contentEl
      .querySelector(".leif-contest-selector")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[1]?.callback?.(new MouseEvent("click")) as Promise<void>);

    await vi.waitFor(() => {
      expect(view.contentEl.textContent).toContain("Seus concursos");
    });
    const table = view.contentEl.querySelector(".leif-table");
    expect(Array.from(table?.querySelectorAll("th") ?? []).map((th) => th.textContent)).toEqual([
      "Concurso",
      "Status",
      "Ações"
    ]);
    const row = table?.querySelector("[data-contest-id='contest-1']");
    expect(row?.querySelector(".leif-table-cell-name")?.textContent).toBe("TRT");
    expect(row?.querySelector(".leif-table-cell-status")?.textContent).toBe("Ativo");
    expect(row?.querySelector(".leif-table-actions .leif-menu-trigger")).not.toBeNull();
    expect(row?.querySelectorAll("button")).toHaveLength(1);

    row
      ?.querySelector(".leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const rowMenu = getShownMenus()[1];
    expect(rowMenu?.items.map((item) => item.title)).toEqual(["Ativar", "Editar", "Excluir"]);
    expect(rowMenu?.items[0]?.disabled).toBe(true);
    await (rowMenu?.items[1]?.callback?.(new MouseEvent("click")) as Promise<void>);

    await vi.waitFor(() => {
      expect(
        view.contentEl.querySelector(
          "[data-contest-id='contest-1'].leif-editing-row [data-contest-editor-name]"
        )
      ).not.toBeNull();
    });
  });

  it("renders the same plain cycle recommendation in Hoje and Registros", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    const dashboardRecommendation = view.contentEl.querySelector(".leif-cycle-recommendation");
    const dashboardSummary = view.contentEl.querySelector(".leif-cycle-recommendation-summary");

    expect(dashboardRecommendation?.getAttribute("aria-label")).toBe("Recomendação do ciclo");
    expect(dashboardSummary?.textContent).toContain("Agora");
    expect(dashboardSummary?.textContent).toContain("Português");
    expect(dashboardSummary?.textContent).toContain("PDF 01");
    expect(dashboardSummary?.textContent).toContain("Próxima: Direito Constitucional");
    expect(dashboardSummary?.textContent).toContain("Motivo: próxima matéria ativa no ciclo.");
    expect(view.contentEl.querySelector(".leif-cycle-thread")).toBeNull();

    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    const sessionsRecommendation = view.contentEl.querySelector(".leif-cycle-recommendation");
    const sessionsSummary = view.contentEl.querySelector(".leif-cycle-recommendation-summary");

    expect(sessionsRecommendation?.getAttribute("aria-label")).toBe("Recomendação do ciclo");
    expect(sessionsSummary?.textContent).toBe(dashboardSummary?.textContent);
    expect(view.contentEl.querySelector(".leif-cycle-thread")).toBeNull();
  });

  it("advances the visual recommendation without creating a record", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );

    const advance = view.contentEl.querySelector(
      ".leif-cycle-recommendation-action"
    ) as HTMLButtonElement;
    expect(advance.textContent).toBe("Avançar para próxima matéria");

    advance.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(async () => {
      const data = await dataStore.load();
      expect(data.cycleStates[0]?.currentSubjectId).toBe("subject-2");
      expect(data.cycleStates[0]?.currentResourceId).toBe("resource-2");
      expect(data.studyRecords).toHaveLength(0);
      expect(
        view.contentEl.querySelector(".leif-cycle-recommendation-summary")?.textContent
      ).toContain("Direito Constitucional");
      expect(view.contentEl.querySelector(".leif-record-feedback")?.textContent).toContain(
        "Recomendação avançada."
      );
    });
  });

  it("lets the learner choose any active subject as the visual recommendation", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    const subject = view.contentEl.querySelector(
      "[data-record-cycle-subject]"
    ) as HTMLSelectElement;

    subject.value = "subject-2";
    subject.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(async () => {
      const data = await dataStore.load();
      expect(data.cycleStates[0]).toMatchObject({
        currentSubjectId: "subject-2",
        currentResourceId: "resource-2"
      });
      expect(data.studyRecords).toEqual([]);
      expect(
        view.contentEl.querySelector(".leif-cycle-recommendation-summary")?.textContent
      ).toContain("Direito Constitucional");
    });
  });

  it("renders the subject summary as a compact table", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiRecordHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    const table = view.contentEl.querySelector(".leif-summary-table");

    expect(Array.from(table?.querySelectorAll("th") ?? []).map((th) => th.textContent)).toEqual([
      "Matéria",
      "Registros",
      "Páginas",
      "Questões"
    ]);
    const portuguese = table?.querySelector("[data-subject-id='subject-1']");
    expect(
      Array.from(portuguese?.querySelectorAll("td") ?? []).map((cell) => cell.textContent)
    ).toEqual(["Português", "2", "12", "0"]);
  });

  it("renders Registros as a compact table with one row per study record", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiRecordHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );

    const table = view.contentEl.querySelector(".leif-record-table");
    expect(Array.from(table?.querySelectorAll("th") ?? []).map((th) => th.textContent)).toEqual([
      "Data",
      "Matéria",
      "Recurso",
      "Assunto",
      "Resultado",
      "Ações"
    ]);
    expect(view.contentEl.querySelector("[data-record-editor-activity]")).toBeNull();
    expect(view.contentEl.querySelector("[data-record-filter-activity]")).toBeNull();
    const records = Array.from(table?.querySelectorAll(".leif-study-record") ?? []);
    const reading = table?.querySelector("[data-record-id='record-1']");
    const questions = table?.querySelector("[data-record-id='record-2']");

    expect(records).toHaveLength(3);
    expect(reading?.textContent).toContain("27/07/2026");
    expect(reading?.textContent).toContain("Leitura noturna");
    expect(reading?.textContent).toContain("Português");
    expect(reading?.textContent).toContain("PDF 01");
    expect(reading?.textContent).toContain("12 páginas");
    expect(questions?.textContent).toContain("Direito Constitucional");
    expect(questions?.textContent).toContain("Controle de constitucionalidade");
    expect(questions?.textContent).toContain("Controle concentrado");
    expect(questions?.textContent).toContain("80% (16/20)");
    expect(reading?.querySelectorAll(".leif-menu-trigger")).toHaveLength(1);

    const unit = view.contentEl.querySelector("[data-record-editor-unit]") as HTMLSelectElement;
    expect(Array.from(unit.options).map((option) => [option.value, option.textContent])).toEqual([
      ["paginas", "Páginas"],
      ["questoes", "Questões"],
      ["aulas", "Aulas"],
      ["minutos", "Minutos"]
    ]);
  });

  it("opens a native menu with record-level actions", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiRecordHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    const menuTrigger = view.contentEl.querySelector(
      "[data-record-id='record-1'] .leif-menu-trigger"
    );
    menuTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const [menu] = getShownMenus();
    expect(menu?.useNativeMenu).toBe(true);
    expect(menu?.items.map((item) => item.title)).toEqual(["Editar registro", "Excluir registro"]);
  });

  it("keeps a record when its targeted deletion confirmation is cancelled", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiRecordHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    view.contentEl
      .querySelector("[data-record-id='record-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[1]?.callback?.(new MouseEvent("click")) as Promise<void>);

    const [modal] = getOpenModals();
    expect(modal?.contentEl.textContent).toContain("27/07/2026");
    modal?.contentEl
      .querySelector("[data-confirmation-cancel]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect((await dataStore.load()).studyRecords).toHaveLength(3);
  });

  it("deletes only the selected record after confirmation", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiRecordHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    view.contentEl
      .querySelector("[data-record-id='record-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[1]?.callback?.(new MouseEvent("click")) as Promise<void>);

    getOpenModals()[0]
      ?.contentEl.querySelector("[data-confirmation-confirm]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(async () => {
      expect((await dataStore.load()).studyRecords.map((record) => record.id)).toEqual([
        "record-2",
        "record-3"
      ]);
      expect(view.contentEl.querySelector("[data-record-id='record-1']")).toBeNull();
      expect(view.contentEl.querySelector("[data-record-id='record-2']")).not.toBeNull();
    });
  });

  it("edits one record without changing neighboring records", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiRecordHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    view.contentEl
      .querySelector("[data-record-id='record-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[0]?.callback?.(new MouseEvent("click")) as Promise<void>);

    await vi.waitFor(() => {
      expect(view.contentEl.querySelector(".leif-record-editor-form")?.textContent).toContain(
        "Editar registro"
      );
    });
    const editor = view.contentEl.querySelector(".leif-record-editor-form");
    const date = editor?.querySelector("[data-record-edit-date]") as HTMLInputElement;
    const notes = editor?.querySelector("[data-record-edit-notes]") as HTMLTextAreaElement;
    date.value = "2026-07-28";
    notes.value = "Leitura ajustada";
    const quantity = editor?.querySelector("[data-record-editor-quantity]") as HTMLInputElement;
    quantity.value = "18";

    (view.contentEl.querySelector("[data-record-edit-save]") as HTMLButtonElement).click();

    await vi.waitFor(async () => {
      const data = await dataStore.load();
      expect(data.studyRecords.find((record) => record.id === "record-1")).toMatchObject({
        date: "2026-07-28",
        notes: "Leitura ajustada",
        quantity: 18
      });
      expect(data.studyRecords.find((record) => record.id === "record-2")).toMatchObject({
        date: "2026-07-27",
        quantity: 20,
        correctAnswers: 16
      });
    });
    expect(view.contentEl.querySelector(".leif-record-editor-form")).toBeNull();
    expect(view.contentEl.textContent).toContain("Leitura ajustada");
  });

  it("keeps the record editor open and unchanged when save validation fails", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiRecordHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    view.contentEl
      .querySelector("[data-record-id='record-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[0]?.callback?.(new MouseEvent("click")) as Promise<void>);
    await vi.waitFor(() => {
      expect(view.contentEl.querySelector(".leif-record-editor-form")).not.toBeNull();
    });

    const editor = view.contentEl.querySelector(".leif-record-editor-form");
    const quantity = editor?.querySelector("[data-record-editor-quantity]") as HTMLInputElement;
    const unit = editor?.querySelector("[data-record-editor-unit]") as HTMLSelectElement;
    quantity.value = "12";
    unit.value = "";

    (view.contentEl.querySelector("[data-record-edit-save]") as HTMLButtonElement).click();

    await vi.waitFor(() => {
      const error = view.contentEl.querySelector(".leif-record-editor-error");
      expect(error?.getAttribute("role")).toBe("alert");
      expect(error?.textContent).toContain("Não foi possível salvar o registro");
    });
    expect(view.contentEl.querySelector(".leif-record-editor-form")).not.toBeNull();
    const data = await dataStore.load();
    expect(data.studyRecords[0].unit).toBe(GoalUnit.PAGINAS);
    expect(data.studyRecords[0].date).toBe("2026-07-27");
  });

  it("filters independent Registros by matéria and date range", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiRecordHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );

    const subject = view.contentEl.querySelector(
      "[data-record-filter-subject]"
    ) as HTMLSelectElement;
    const from = view.contentEl.querySelector("[data-record-filter-from]") as HTMLInputElement;
    const to = view.contentEl.querySelector("[data-record-filter-to]") as HTMLInputElement;

    expect(view.contentEl.querySelector("[data-record-id='record-1']")).not.toBeNull();
    expect(view.contentEl.querySelector("[data-record-id='record-3']")).not.toBeNull();

    subject.value = "subject-2";
    subject.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(view.contentEl.querySelector("[data-record-id='record-2']")).not.toBeNull();
      expect(view.contentEl.querySelector("[data-record-id='record-1']")).toBeNull();
      expect(view.contentEl.querySelector("[data-record-id='record-3']")).toBeNull();
    });

    from.value = "2026-07-28";
    from.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(view.contentEl.querySelector("[data-record-id='record-2']")).toBeNull();
      expect(view.contentEl.textContent).toContain("Nenhum registro encontrado");
    });

    from.value = "2026-07-01";
    from.dispatchEvent(new Event("change", { bubbles: true }));
    to.value = "2026-07-27";
    to.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(view.contentEl.querySelector("[data-record-id='record-2']")).not.toBeNull();
    });
  });

  it("saves multiple draft rows as independent records without advancing the recommendation", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    const firstRecord = view.contentEl.querySelector("[data-record-draft-index='0']");
    const firstResource = firstRecord?.querySelector(
      "[data-record-editor-resource]"
    ) as HTMLSelectElement;
    firstResource.value = "resource-1";
    (view.contentEl.querySelector("[data-record-create-add]") as HTMLButtonElement).click();
    const secondRecord = view.contentEl.querySelector("[data-record-draft-index='1']");
    const subject = secondRecord?.querySelector(
      "[data-record-editor-subject]"
    ) as HTMLSelectElement;
    const resource = secondRecord?.querySelector(
      "[data-record-editor-resource]"
    ) as HTMLSelectElement;
    subject.value = "subject-2";
    subject.dispatchEvent(new Event("change", { bubbles: true }));
    resource.value = "resource-2";

    (view.contentEl.querySelector("[data-record-create-save]") as HTMLButtonElement).click();

    await vi.waitFor(async () => {
      const data = await dataStore.load();
      expect(data.cycleStates[0].currentSubjectId).toBe("subject-1");
      expect(data.studyRecords).toHaveLength(2);
      expect(data.studyRecords.map((record) => record.subjectId)).toEqual([
        "subject-1",
        "subject-2"
      ]);
    });
    expect(view.contentEl.querySelector(".leif-record-feedback")).toBeNull();
  });

  it("undoes an explicit recommendation advance", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    (
      view.contentEl.querySelector(".leif-cycle-recommendation-action") as HTMLButtonElement
    ).click();

    await vi.waitFor(async () => {
      expect((await dataStore.load()).cycleStates[0].currentSubjectId).toBe("subject-2");
    });
    (view.contentEl.querySelector("[data-record-cycle-undo]") as HTMLButtonElement).click();

    await vi.waitFor(async () => {
      const data = await dataStore.load();
      expect(data.cycleStates[0].currentSubjectId).toBe("subject-1");
      expect(data.cycleStates[0].currentResourceId).toBe("resource-1");
    });
    expect(view.contentEl.querySelector("[data-record-cycle-undo]")).toBeNull();
  });

  it("renders the Recursos view as a readable table with a sticky Actions column", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "items") => Promise<void> }).openTab("items");

    const table = view.contentEl.querySelector(".leif-table");
    expect(table?.querySelectorAll("th")?.[0]?.textContent).toBe("Recurso");
    expect(Array.from(table?.querySelectorAll("th") ?? []).map((th) => th.textContent)).toEqual([
      "Recurso",
      "Formato",
      "Meta",
      "Materiais",
      "Ações"
    ]);

    const row = table?.querySelector("[data-resource-id='resource-1']") as HTMLTableRowElement;
    expect(row).toBeInstanceOf(HTMLTableRowElement);
    const nameCell = row.querySelector(".leif-table-cell-name");
    expect(nameCell?.textContent).toBe("PDF 01");
    const actionsCell = row.querySelector(".leif-table-actions");
    expect(actionsCell?.classList.contains("leif-table-actions")).toBe(true);
    expect(actionsCell?.querySelector(".leif-menu-trigger")).not.toBeNull();
    expect(row.querySelectorAll("button")).toHaveLength(1);
  });

  it("renders long Recurso names in full without truncation inside table cells", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);
    await dataStore.mutate((draft) => {
      draft.resources.push(
        new Resource(
          "resource-long",
          "subject-1",
          "Direito Constitucional - Teoria Geral e Controle de Constitucionalidade",
          99
        )
      );
    });

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "items") => Promise<void> }).openTab("items");

    const longRow = view.contentEl.querySelector("[data-resource-id='resource-long']");
    const nameCell = longRow?.querySelector(".leif-table-cell-name") as HTMLElement;
    expect(nameCell.textContent).toBe(
      "Direito Constitucional - Teoria Geral e Controle de Constitucionalidade"
    );
    expect(nameCell.style.textOverflow).toBe("");
    expect(nameCell.style.overflow).toBe("");
  });

  it("opens the Recursos row actions menu and edits a recurso inline", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "items") => Promise<void> }).openTab("items");
    view.contentEl
      .querySelector("[data-resource-id='resource-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[0]?.callback?.(new MouseEvent("click")) as Promise<void>);

    await vi.waitFor(() => {
      const editor = view.contentEl.querySelector(
        "[data-resource-id='resource-1'].leif-editing-row"
      );
      expect(editor).not.toBeNull();
    });
    const editor = view.contentEl.querySelector("[data-resource-id='resource-1'].leif-editing-row");
    expect(
      (editor?.querySelector("[data-resource-editor-title]") as HTMLInputElement | null)?.value
    ).toBe("PDF 01");
  });

  it("adds and opens a web material link for a recurso in the selected matéria", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "items") => Promise<void> }).openTab("items");
    view.contentEl
      .querySelector("[data-resource-id='resource-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[0]?.callback?.(new MouseEvent("click")) as Promise<void>);

    await vi.waitFor(() => {
      expect(view.contentEl.querySelector("[data-resource-access-create-title]")).not.toBeNull();
    });
    const title = view.contentEl.querySelector(
      "[data-resource-access-create-title]"
    ) as HTMLInputElement;
    const url = view.contentEl.querySelector(
      "[data-resource-access-create-url]"
    ) as HTMLInputElement;
    title.value = "Curso na web";
    url.value = "https://example.com/curso";
    view.contentEl
      .querySelector("[data-resource-access-create-save]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(async () => {
      expect((await dataStore.load()).resources[0].accesses).toEqual([
        new ResourceAccess("Curso na web", "https://example.com/curso")
      ]);
    });
    const link = view.contentEl.querySelector(
      "[data-resource-id='resource-1'] a[href='https://example.com/curso']"
    );
    expect(link?.textContent).toBe("Curso na web");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("keeps a recurso when its targeted deletion confirmation is cancelled", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "items") => Promise<void> }).openTab("items");
    view.contentEl
      .querySelector("[data-resource-id='resource-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[1]?.callback?.(new MouseEvent("click")) as Promise<void>);

    const [modal] = getOpenModals();
    expect(modal?.contentEl.textContent).toContain("PDF 01");
    modal?.contentEl
      .querySelector("[data-confirmation-cancel]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(
      (await dataStore.load()).resources.some((resource) => resource.id === "resource-1")
    ).toBe(true);
  });

  it("deletes a recurso after its native confirmation is accepted", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "items") => Promise<void> }).openTab("items");
    view.contentEl
      .querySelector("[data-resource-id='resource-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[1]?.callback?.(new MouseEvent("click")) as Promise<void>);

    getOpenModals()[0]
      ?.contentEl.querySelector("[data-confirmation-confirm]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(async () => {
      expect(
        (await dataStore.load()).resources.some((resource) => resource.id === "resource-1")
      ).toBe(false);
    });
  });

  it("renders the Assuntos view as a readable table with the sticky actions column", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);
    await dataStore.mutate((draft) => {
      draft.topics.push(new Topic("topic-1", "subject-1", "Concordância nominal"));
    });

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "topics") => Promise<void> }).openTab("topics");

    const table = view.contentEl.querySelector(".leif-table");
    expect(Array.from(table?.querySelectorAll("th") ?? []).map((th) => th.textContent)).toEqual([
      "Assunto",
      "Ações"
    ]);
    const row = table?.querySelector("[data-topic-id='topic-1']") as HTMLTableRowElement;
    expect(row.querySelector(".leif-table-cell-name")?.textContent).toBe("Concordância nominal");
    expect(row.querySelector(".leif-table-actions .leif-menu-trigger")).not.toBeNull();
    expect(row.querySelectorAll("button")).toHaveLength(1);
  });

  it("keeps an assunto when its targeted deletion confirmation is cancelled", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);
    await dataStore.mutate((draft) => {
      draft.topics.push(new Topic("topic-1", "subject-1", "Concordância nominal"));
    });
    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "topics") => Promise<void> }).openTab("topics");
    view.contentEl
      .querySelector("[data-topic-id='topic-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[1]?.callback?.(new MouseEvent("click")) as Promise<void>);

    const [modal] = getOpenModals();
    expect(modal?.contentEl.textContent).toContain("Concordância nominal");
    modal?.contentEl
      .querySelector("[data-confirmation-cancel]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect((await dataStore.load()).topics.some((topic) => topic.id === "topic-1")).toBe(true);
  });

  it("renders the Matérias table with a sticky Actions column and one-line No ciclo", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "cycle") => Promise<void> }).openTab("cycle");

    const row = view.contentEl.querySelector(
      "[data-subject-id='subject-1']"
    ) as HTMLTableRowElement;
    expect(row.querySelector(".leif-table-cell-name")?.textContent).toBe("Português");
    expect(row.querySelector(".leif-table-cell-status")?.textContent).toBe("No ciclo");
    expect(row.querySelector(".leif-table-actions .leif-menu-trigger")).not.toBeNull();
    view.contentEl
      .querySelector("[data-subject-id='subject-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const menu = getShownMenus()[0];
    expect(menu?.items.map((item) => item.title)).toEqual(["Pausar no ciclo", "Editar"]);
  });

  it("renders the Mural in read mode and toggles into edit mode", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);
    await new UpdateContestMuralUseCase(dataStore, new EntityRepositoryFactory(dataStore)).execute({
      contestId: "contest-1",
      notes: "## Lembrete\n\n- Fração de concursos da FCC"
    });
    const renderSpy = vi
      .spyOn(MarkdownRenderer, "render")
      .mockImplementation(async (_app, markdown, element) => {
        element.textContent = markdown;
      });

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "wall") => Promise<void> }).openTab("wall");

    const readView = view.contentEl.querySelector(".leif-wall-read-view");
    expect(readView).not.toBeNull();
    expect(readView?.querySelector('button[data-wall-edit="true"]')).not.toBeNull();
    expect(renderSpy).toHaveBeenCalled();
    expect(readView?.textContent).toContain("Fração de concursos da FCC");

    (view.contentEl.querySelector('button[data-wall-edit="true"]') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(view.contentEl.querySelector(".leif-wall-editor")).not.toBeNull();
    });
    const editor = view.contentEl.querySelector(".leif-wall-editor") as HTMLElement;
    const notes = editor.querySelector("textarea[data-wall-notes='true']") as HTMLTextAreaElement;
    expect(notes.value).toContain("Fração de concursos da FCC");
    renderSpy.mockRestore();
  });

  it("saves Mural notes from edit mode and returns to read mode", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);
    await new UpdateContestMuralUseCase(dataStore, new EntityRepositoryFactory(dataStore)).execute({
      contestId: "contest-1",
      notes: "Texto antigo"
    });

    const renderSpy = vi
      .spyOn(MarkdownRenderer, "render")
      .mockImplementation(async (_app, markdown, element) => {
        element.textContent = markdown;
      });

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "wall") => Promise<void> }).openTab("wall");
    (view.contentEl.querySelector('button[data-wall-edit="true"]') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(view.contentEl.querySelector(".leif-wall-editor")).not.toBeNull();
    });
    const editor = view.contentEl.querySelector(".leif-wall-editor") as HTMLElement;
    const notes = editor.querySelector("textarea[data-wall-notes='true']") as HTMLTextAreaElement;
    notes.value = "## Material novo\n\n- PDF atualizado";
    (editor.querySelector('button[data-wall-save="true"]') as HTMLButtonElement).click();
    renderSpy.mockRestore();

    await vi.waitFor(async () => {
      const data = await dataStore.load();
      expect(data.contests[0].mural.notes).toBe("## Material novo\n\n- PDF atualizado");
    });
    expect(view.contentEl.querySelector(".leif-wall-editor")).toBeNull();
    expect(view.contentEl.textContent).toContain("PDF atualizado");
  });
});
