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
import { StudySession } from "@/domain/entities/StudySession";
import { Topic } from "@/domain/entities/Topic";
import { GoalUnit } from "@/domain/types/GoalUnit";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { LEIF_VIEW_TYPE, registerLeifView } from "@/ui/view/registerLeifView";
import { App, getShownMenus, Plugin, resetShownMenus } from "../mocks/obsidian";
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

async function seedUiSessionHistory(dataStore: PluginDataStore): Promise<void> {
  await seedUiCycleData(dataStore);
  await dataStore.mutate((draft) => {
    draft.studySessions.push(
      new StudySession(
        "session-1",
        "contest-1",
        "2026-07-27",
        [
          new StudyRecord(
            "record-1",
            "subject-1",
            "leitura",
            "resource-1",
            undefined,
            12,
            GoalUnit.PAGINAS,
            undefined,
            true
          ),
          new StudyRecord(
            "record-2",
            "subject-2",
            "questoes",
            "resource-2",
            "topic-2",
            20,
            GoalUnit.QUESTOES,
            16,
            true
          )
        ],
        "19:00",
        "20:30",
        "Bloco noturno"
      ),
      new StudySession(
        "session-2",
        "contest-1",
        "2026-07-20",
        [
          new StudyRecord(
            "record-3",
            "subject-1",
            "revisao",
            "resource-1",
            undefined,
            30,
            GoalUnit.MINUTOS,
            undefined,
            true
          )
        ],
        "08:00",
        "08:30",
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

  it("renders the subject summary as a compact table", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiSessionHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    const table = view.contentEl.querySelector(".leif-summary-table");

    expect(Array.from(table?.querySelectorAll("th") ?? []).map((th) => th.textContent)).toEqual([
      "Matéria",
      "Sessões",
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
    await seedUiSessionHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );

    const table = view.contentEl.querySelector(".leif-session-table");
    expect(Array.from(table?.querySelectorAll("th") ?? []).map((th) => th.textContent)).toEqual([
      "Data",
      "Horário",
      "Matéria",
      "Recurso",
      "Assunto",
      "Atividade",
      "Resultado",
      "Ações"
    ]);
    const session = table?.querySelector("[data-session-id='session-1']");
    const records = Array.from(
      table?.querySelectorAll("[data-session-id='session-1'].leif-session-record") ?? []
    );

    expect(session?.textContent).toContain("27/07/2026");
    expect(session?.textContent).toContain("19:00–20:30");
    expect(session?.textContent).toContain("Bloco noturno");
    expect(records).toHaveLength(2);
    expect(records[0]?.textContent).toContain("Português");
    expect(records[0]?.textContent).toContain("PDF 01");
    expect(records[0]?.textContent).toContain("leitura");
    expect(records[0]?.textContent).toContain("12 paginas");
    expect(records[1]?.textContent).toContain("Direito Constitucional");
    expect(records[1]?.textContent).toContain("Controle de constitucionalidade");
    expect(records[1]?.textContent).toContain("Controle concentrado");
    expect(records[1]?.textContent).toContain("questoes");
    expect(records[1]?.textContent).toContain("16/20 acertos");
    expect(session?.querySelectorAll(".leif-menu-trigger")).toHaveLength(1);
  });

  it("opens a native session menu with session-level actions", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiSessionHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    const menuTrigger = view.contentEl.querySelector(
      "[data-session-id='session-1'] .leif-menu-trigger"
    );
    menuTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const [menu] = getShownMenus();
    expect(menu?.useNativeMenu).toBe(true);
    expect(menu?.items.map((item) => item.title)).toEqual([
      "Editar sessão",
      "Adicionar registro",
      "Excluir sessão"
    ]);
  });

  it("keeps a session when its targeted deletion confirmation is cancelled", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiSessionHistory(dataStore);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    view.contentEl
      .querySelector("[data-session-id='session-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[2]?.callback?.(new MouseEvent("click")) as Promise<void>);

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("27/07/2026"));
    expect((await dataStore.load()).studySessions).toHaveLength(2);
    confirm.mockRestore();
  });

  it("edits a grouped session and saves all records together", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiSessionHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    view.contentEl
      .querySelector("[data-session-id='session-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[0]?.callback?.(new MouseEvent("click")) as Promise<void>);

    await vi.waitFor(() => {
      expect(view.contentEl.querySelector(".leif-session-editor")?.textContent).toContain(
        "Editar sessão"
      );
    });
    const editor = view.contentEl.querySelector(".leif-session-editor");
    expect(editor?.textContent).toContain("Editar sessão");
    const date = editor?.querySelector("[data-session-editor-date]") as HTMLInputElement;
    const start = editor?.querySelector("[data-session-editor-start]") as HTMLInputElement;
    const end = editor?.querySelector("[data-session-editor-end]") as HTMLInputElement;
    const notes = editor?.querySelector("[data-session-editor-notes]") as HTMLTextAreaElement;
    date.value = "2026-07-28";
    start.value = "20:00";
    end.value = "21:15";
    notes.value = "Bloco ajustado";

    const firstRecord = editor?.querySelector("[data-record-editor-index='0']");
    const firstActivity = firstRecord?.querySelector(
      "[data-record-editor-activity]"
    ) as HTMLInputElement;
    const firstQuantity = firstRecord?.querySelector(
      "[data-record-editor-quantity]"
    ) as HTMLInputElement;
    firstActivity.value = "revisao";
    firstQuantity.value = "18";

    (
      editor?.querySelector("[data-record-editor-index='1'] [data-record-editor-remove]") as
        HTMLButtonElement | undefined
    )?.click();
    (view.contentEl.querySelector("[data-session-editor-add-record]") as HTMLButtonElement).click();
    const addedRecord = view.contentEl.querySelector("[data-record-editor-index='1']");
    const addedSubject = addedRecord?.querySelector(
      "[data-record-editor-subject]"
    ) as HTMLSelectElement;
    const addedResource = addedRecord?.querySelector(
      "[data-record-editor-resource]"
    ) as HTMLSelectElement;
    const addedActivity = addedRecord?.querySelector(
      "[data-record-editor-activity]"
    ) as HTMLInputElement;
    const addedQuantity = addedRecord?.querySelector(
      "[data-record-editor-quantity]"
    ) as HTMLInputElement;
    const addedCorrect = addedRecord?.querySelector(
      "[data-record-editor-correct]"
    ) as HTMLInputElement;
    addedSubject.value = "subject-2";
    addedSubject.dispatchEvent(new Event("change", { bubbles: true }));
    addedResource.value = "resource-2";
    addedActivity.value = "questoes";
    addedQuantity.value = "30";
    addedCorrect.value = "24";

    (view.contentEl.querySelector("[data-session-editor-save]") as HTMLButtonElement).click();

    await vi.waitFor(async () => {
      const data = await dataStore.load();
      expect(data.studySessions[0].date).toBe("2026-07-28");
      expect(data.studySessions[0].startTime).toBe("20:00");
      expect(data.studySessions[0].endTime).toBe("21:15");
      expect(data.studySessions[0].notes).toBe("Bloco ajustado");
      expect(data.studySessions[0].records).toHaveLength(2);
      expect(data.studySessions[0].records[0].id).toBe("record-1");
      expect(data.studySessions[0].records[0].activity).toBe("revisao");
      expect(data.studySessions[0].records[0].quantity).toBe(18);
      expect(data.studySessions[0].records[1].subjectId).toBe("subject-2");
      expect(data.studySessions[0].records[1].resourceId).toBe("resource-2");
      expect(data.studySessions[0].records[1].correctAnswers).toBe(24);
    });
    expect(view.contentEl.querySelector(".leif-session-editor")).toBeNull();
    expect(view.contentEl.textContent).toContain("Bloco ajustado");
  });

  it("keeps the session editor open and unchanged when save validation fails", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiSessionHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    view.contentEl
      .querySelector("[data-session-id='session-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[0]?.callback?.(new MouseEvent("click")) as Promise<void>);
    await vi.waitFor(() => {
      expect(view.contentEl.querySelector(".leif-session-editor")).not.toBeNull();
    });

    const editor = view.contentEl.querySelector(".leif-session-editor");
    const firstRecord = editor?.querySelector("[data-record-editor-index='0']");
    const quantity = firstRecord?.querySelector(
      "[data-record-editor-quantity]"
    ) as HTMLInputElement;
    const unit = firstRecord?.querySelector("[data-record-editor-unit]") as HTMLSelectElement;
    quantity.value = "12";
    unit.value = "";

    (view.contentEl.querySelector("[data-session-editor-save]") as HTMLButtonElement).click();

    await vi.waitFor(() => {
      const error = view.contentEl.querySelector(".leif-session-editor-error");
      expect(error?.getAttribute("role")).toBe("alert");
      expect(error?.textContent).toContain("Não foi possível salvar a sessão");
    });
    expect(view.contentEl.querySelector(".leif-session-editor")).not.toBeNull();
    const data = await dataStore.load();
    expect(data.studySessions[0].records[0].unit).toBe(GoalUnit.PAGINAS);
    expect(data.studySessions[0].date).toBe("2026-07-27");
  });

  it("filters grouped Registros by matéria, activity, and date range", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiSessionHistory(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );

    const subject = view.contentEl.querySelector(
      "[data-session-filter-subject]"
    ) as HTMLSelectElement;
    const activity = view.contentEl.querySelector(
      "[data-session-filter-activity]"
    ) as HTMLSelectElement;
    const from = view.contentEl.querySelector("[data-session-filter-from]") as HTMLInputElement;
    const to = view.contentEl.querySelector("[data-session-filter-to]") as HTMLInputElement;

    expect(view.contentEl.querySelector("[data-session-id='session-1']")).not.toBeNull();
    expect(view.contentEl.querySelector("[data-session-id='session-2']")).not.toBeNull();

    subject.value = "subject-2";
    subject.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      const session = view.contentEl.querySelector("[data-session-id='session-1']");
      expect(session?.textContent).toContain("Direito Constitucional");
      expect(session?.textContent).not.toContain("Português");
      expect(view.contentEl.querySelector("[data-session-id='session-2']")).toBeNull();
    });

    activity.value = "questoes";
    activity.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(view.contentEl.querySelector("[data-session-id='session-1']")?.textContent).toContain(
        "questoes"
      );
      expect(
        view.contentEl.querySelector("[data-session-id='session-1']")?.textContent
      ).not.toContain("leitura");
    });

    from.value = "2026-07-28";
    from.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(view.contentEl.querySelector("[data-session-id='session-1']")).toBeNull();
      expect(view.contentEl.textContent).toContain("Nenhum registro encontrado");
    });

    from.value = "2026-07-01";
    from.dispatchEvent(new Event("change", { bubbles: true }));
    to.value = "2026-07-27";
    to.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(view.contentEl.querySelector("[data-session-id='session-1']")).not.toBeNull();
    });
  });

  it("undoes the cycle advancement produced by a multi-record session", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiCycleData(dataStore);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "sessions") => Promise<void> }).openTab(
      "sessions"
    );
    const firstRecord = view.contentEl.querySelector("[data-record-editor-index='0']");
    const firstResource = firstRecord?.querySelector(
      "[data-record-editor-resource]"
    ) as HTMLSelectElement;
    firstResource.value = "resource-1";
    (view.contentEl.querySelector("[data-session-create-add-record]") as HTMLButtonElement).click();
    const secondRecord = view.contentEl.querySelector("[data-record-editor-index='1']");
    const subject = secondRecord?.querySelector(
      "[data-record-editor-subject]"
    ) as HTMLSelectElement;
    const resource = secondRecord?.querySelector(
      "[data-record-editor-resource]"
    ) as HTMLSelectElement;
    subject.value = "subject-2";
    subject.dispatchEvent(new Event("change", { bubbles: true }));
    resource.value = "resource-2";

    (view.contentEl.querySelector("[data-session-create-save]") as HTMLButtonElement).click();

    await vi.waitFor(async () => {
      const data = await dataStore.load();
      expect(data.cycleStates[0].currentSubjectId).toBe("subject-3");
      expect(data.studySessions).toHaveLength(1);
      expect(data.studySessions[0].records).toHaveLength(2);
    });
    expect(view.contentEl.textContent).toContain("Ciclo avançado");

    (view.contentEl.querySelector("[data-session-cycle-undo]") as HTMLButtonElement).click();

    await vi.waitFor(async () => {
      const data = await dataStore.load();
      expect(data.cycleStates[0].currentSubjectId).toBe("subject-1");
      expect(data.cycleStates[0].currentResourceId).toBe("resource-1");
    });
    expect(view.contentEl.querySelector("[data-session-cycle-undo]")).toBeNull();
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
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "items") => Promise<void> }).openTab("items");
    view.contentEl
      .querySelector("[data-resource-id='resource-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[1]?.callback?.(new MouseEvent("click")) as Promise<void>);

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("PDF 01"));
    expect(
      (await dataStore.load()).resources.some((resource) => resource.id === "resource-1")
    ).toBe(true);
    confirm.mockRestore();
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
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    const { view } = await openLeifView(dataStore);
    await (view as unknown as { openTab: (tabId: "topics") => Promise<void> }).openTab("topics");
    view.contentEl
      .querySelector("[data-topic-id='topic-1'] .leif-menu-trigger")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await (getShownMenus()[0]?.items[1]?.callback?.(new MouseEvent("click")) as Promise<void>);

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Concordância nominal"));
    expect((await dataStore.load()).topics.some((topic) => topic.id === "topic-1")).toBe(true);
    confirm.mockRestore();
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
