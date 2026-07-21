// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { AddStudyItemResourceReferenceUseCase } from "@/application/use-cases/AddStudyItemResourceReferenceUseCase";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { CreateTopicUseCase } from "@/application/use-cases/CreateTopicUseCase";
import { LinkQuestionNotebookUseCase } from "@/application/use-cases/LinkQuestionNotebookUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { UpdateContestWallUseCase } from "@/application/use-cases/UpdateContestWallUseCase";
import { UpdateStudyItemUseCase } from "@/application/use-cases/UpdateStudyItemUseCase";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { App, getRecordedNotices, Plugin, resetRecordedNotices } from "../mocks/obsidian";
import { LEIF_VIEW_TYPE, registerLeifView } from "@/ui/view/registerLeifView";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { seedMinimalContest } from "../fixtures/seedMinimalContest";

class InMemoryPluginDataStore implements PluginDataStore {
  constructor(private data: LeifPluginData = createDefaultLeifPluginData()) {}

  async load(): Promise<LeifPluginData> {
    return this.data;
  }

  async save(data: LeifPluginData): Promise<void> {
    this.data = data;
  }
}

async function seedUiData(dataStore: PluginDataStore): Promise<EntityRepositoryFactory> {
  const factory = new EntityRepositoryFactory(dataStore);
  const createContest = new CreateContestUseCase(dataStore, factory);
  const createSubject = new CreateSubjectUseCase(dataStore, factory);
  const createStudyItem = new CreateStudyItemUseCase(dataStore, factory);
  const updateContestWall = new UpdateContestWallUseCase(dataStore, factory);
  const registerStudySession = new RegisterStudySessionUseCase(dataStore, factory);

  await createContest.execute({ id: "contest-2", name: "SEFAZ" });
  const { contestId, subjectId } = await seedMinimalContest(dataStore);
  await createSubject.execute({
    id: "subject-2",
    contestId,
    name: "Constitutional Law",
    plannedStudyMinutes: 45
  });
  const item1 = await createStudyItem.execute({ subjectId, title: "Sintaxe" });
  await updateContestWall.execute({
    contestId,
    wall: {
      noticeLinks: [{ id: "notice-1", label: "Edital", url: "https://example.com/edital" }],
      examLinks: [],
      subjectSnapshots: [],
      notes: "Foco em portugues."
    }
  });
  await registerStudySession.execute({
    id: "session-1",
    contestId,
    subjectId,
    studyItemId: item1.id,
    type: "pdf",
    studiedAt: "2026-06-11T20:00:00.000Z",
    pagesOrCount: 20,
    completed: true
  });

  return factory;
}

async function openLeifView(dataStore: PluginDataStore): Promise<{
  plugin: Plugin;
  app: App;
  leaf: App["workspace"]["leaves"][number];
  view: NonNullable<App["workspace"]["leaves"][number]["view"]>;
}> {
  const app = new App();
  const plugin = new Plugin(app);
  registerLeifView(plugin as never, dataStore);

  const openCommand = plugin.commands.find((command) => command.id === "open-view");

  if (!openCommand) {
    throw new Error("Open view command was not registered.");
  }

  await openCommand.callback();

  const leaf = app.workspace.getLeavesOfType(LEIF_VIEW_TYPE)[0];

  if (!leaf?.view) {
    throw new Error("Leif view was not opened.");
  }

  return { plugin, app, leaf, view: leaf.view };
}

describe("LeifView", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    resetRecordedNotices();
    vi.unstubAllGlobals();
  });

  it("adapts navigation to the actual Obsidian pane width", async () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();

    class ResizeObserverStub {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(): void {}

      disconnect(): void {
        disconnect();
      }
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverStub);

    const { leaf, view } = await openLeifView(new InMemoryPluginDataStore());
    const root = leaf.containerEl.querySelector<HTMLElement>(".leif-view");

    resizeCallback?.(
      [{ contentRect: { width: 700 } } as ResizeObserverEntry],
      {} as ResizeObserver
    );
    expect(root?.classList.contains("is-narrow")).toBe(true);
    expect(root?.classList.contains("is-compact")).toBe(false);

    resizeCallback?.(
      [{ contentRect: { width: 480 } } as ResizeObserverEntry],
      {} as ResizeObserver
    );
    expect(root?.classList.contains("is-compact")).toBe(true);

    resizeCallback?.(
      [{ contentRect: { width: 900 } } as ResizeObserverEntry],
      {} as ResizeObserver
    );
    expect(root?.classList.contains("is-narrow")).toBe(false);
    expect(root?.classList.contains("is-compact")).toBe(false);

    await view.onClose();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("opens the Leif view and renders all required tabs for an empty state", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const { plugin, leaf } = await openLeifView(dataStore);

    expect(plugin.ribbonIcons).toHaveLength(1);
    expect(plugin.ribbonIcons[0]?.title).toBe("Abrir Leif");
    expect(plugin.commands.map((command) => command.id)).toContain("open-view");
    expect(plugin.commands.find((command) => command.id === "open-view")?.name).toBe(
      "Abrir painel"
    );
    expect(leaf.containerEl.textContent).toContain("Hoje");
    expect(leaf.containerEl.textContent).toContain("Matérias");
    expect(leaf.containerEl.textContent).toContain("Edital");
    expect(leaf.containerEl.textContent).toContain("Registros");
    expect(leaf.containerEl.textContent).toContain("Recursos");
    expect(leaf.containerEl.textContent).toContain("Concursos");
    expect(leaf.containerEl.textContent).toContain("Mural");
    expect(leaf.containerEl.textContent).toContain("Nada escolhido ainda");

    const tabLabels = Array.from(leaf.containerEl.querySelectorAll("[role='tab']")).map(
      (tab) => tab.querySelector(".leif-tab-label")?.textContent?.trim() ?? ""
    );
    expect(tabLabels).toEqual([
      "Hoje",
      "Registros",
      "Matérias",
      "Edital",
      "Recursos",
      "Concursos",
      "Mural"
    ]);
    const tabs = Array.from(leaf.containerEl.querySelectorAll<HTMLButtonElement>("[role='tab']"));
    expect(tabs.every((tab) => tab.tagName === "BUTTON" && tab.type === "button")).toBe(true);
    expect(tabs.every((tab) => tab.querySelector(".leif-tab-icon[data-icon]"))).toBe(true);
    expect(tabs.every((tab) => tab.querySelector(".leif-tab-label")?.textContent?.trim())).toBe(
      true
    );
    expect(leaf.containerEl.querySelector(".leif-workspace")).not.toBeNull();
    expect(leaf.containerEl.querySelector(".leif-navigation")).not.toBeNull();
    expect(leaf.containerEl.querySelector(".leif-navigation-label")).toBeNull();
    expect(leaf.containerEl.textContent).not.toContain("Navegar");
  });

  it("uses native Obsidian classes for buttons and form controls", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const newSessionButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button.clickable-icon[aria-label='Nova sessão']"
    );
    const finishCycleButton = Array.from(leaf.containerEl.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Marcar como estudado")
    );

    expect(newSessionButton).not.toBeNull();
    expect(finishCycleButton?.classList.contains("mod-cta")).toBe(true);

    newSessionButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = leaf.containerEl.querySelector<HTMLFormElement>("form.leif-card");
    const input = form?.querySelector<HTMLInputElement>("input");
    const select = form?.querySelector<HTMLSelectElement>("select");

    expect(document.body.querySelector(".modal")).toBeNull();
    expect(form).not.toBeNull();
    expect(input?.classList.contains("leif-input")).toBe(false);
    expect(select?.classList.contains("leif-select")).toBe(false);
  });

  it("renders dashboard data from the active contest", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);

    expect(leaf.containerEl.textContent).toContain("TRT");
    expect(leaf.containerEl.textContent).toContain("Portuguese");
    expect(leaf.containerEl.textContent).toContain("Constitutional Law");
    expect(leaf.containerEl.textContent).toContain("20");
    expect(leaf.containerEl.textContent).toContain("O que estudar agora");
  });

  it("surfaces the next study activity as a focused dashboard panel", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const nextActivity = leaf.containerEl.querySelector<HTMLElement>(".leif-next-activity");

    expect(nextActivity?.textContent).toContain("Estudar agora");
    expect(nextActivity?.textContent).toContain("Portuguese");
    expect(nextActivity?.textContent).toContain("Sintaxe");
    expect(nextActivity?.textContent).toContain("60 min");
    expect(nextActivity?.textContent).toContain("sem etapa");
    expect(nextActivity?.textContent).toContain("Próxima matéria: Constitutional Law");
    expect(
      nextActivity?.querySelector(".leif-next-activity-meta .leif-next-activity-next")
    ).toBeNull();
    const nextSubject = nextActivity?.querySelector(":scope > .leif-next-activity-next");
    expect(nextSubject).not.toBeNull();
    expect(nextSubject?.previousElementSibling).toBe(
      nextActivity?.querySelector(".leif-next-activity-meta")
    );
  });

  it("opens Registros from the dashboard study panel", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const nextActivity = leaf.containerEl.querySelector<HTMLElement>(".leif-next-activity");
    const registerButton = Array.from(nextActivity?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.includes("Ir para Registros")
    );

    expect(nextActivity?.textContent).not.toContain("Registre o estudo na aba Registros");
    expect(registerButton).not.toBeUndefined();

    registerButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const sessionsTab = leaf.containerEl.querySelector<HTMLElement>("[data-tab='sessions']");
    expect(sessionsTab?.getAttribute("aria-selected")).toBe("true");
    expect(leaf.containerEl.querySelector("#leif-tabpanel")?.textContent).toContain("Registros");
  });

  it("guides the user when today's page has no active subject yet", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = new EntityRepositoryFactory(dataStore);
    const createContest = new CreateContestUseCase(dataStore, factory);

    await createContest.execute({ id: "contest-empty", name: "TJ" });

    const { leaf } = await openLeifView(dataStore);
    const nextActivity = leaf.containerEl.querySelector<HTMLElement>(".leif-next-activity");
    const registerButton = Array.from(leaf.containerEl.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Registrar agora")
    );

    expect(nextActivity?.textContent).toContain("Sem matéria ativa");
    expect(nextActivity?.textContent).toContain("Crie ou ative uma matéria em Matérias");
    expect(registerButton).toBeUndefined();
  });

  it("keeps today's tab read-only for study registration", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const before = await dataStore.load();
    const registerButton = Array.from(leaf.containerEl.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Registrar agora")
    );
    const nextActivity = leaf.containerEl.querySelector<HTMLElement>(".leif-next-activity");
    const form = nextActivity?.querySelector("form");

    expect(nextActivity?.textContent).toContain("Estudar agora");
    expect(nextActivity?.textContent).toContain("Portuguese");
    expect(registerButton).toBeUndefined();
    expect(form).toBeNull();

    const after = await dataStore.load();
    expect(after.studySessions).toHaveLength(before.studySessions.length);
  });

  it("switches the active contest from the contests tab and rerenders the dashboard", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const contestsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='contests']");

    if (!contestsTabButton) {
      throw new Error("Contests tab button was not rendered.");
    }

    contestsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const activateButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "[data-contest-id='contest-2']"
    );

    if (!activateButton) {
      throw new Error("Activate contest button was not rendered.");
    }

    activateButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const dashboardTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='dashboard']");

    if (!dashboardTabButton) {
      throw new Error("Hoje tab button was not rendered.");
    }

    dashboardTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(leaf.containerEl.textContent).toContain("SEFAZ");
  });

  it("shows cycle subjects in a compact table with status and reorder controls", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);
    const registerSession = new RegisterStudySessionUseCase(dataStore, factory);
    await registerSession.execute({
      id: "session-cycle-accuracy",
      contestId: "contest-1",
      subjectId: "subject-1",
      type: "questions",
      studiedAt: "2026-06-12T20:00:00.000Z",
      pagesOrCount: 20,
      correctAnswers: 15,
      completed: true
    });
    const seededData = await dataStore.load();
    seededData.subjects = seededData.subjects.map((subject) =>
      subject.id === "subject-2" ? { ...subject, isActive: false } : subject
    );
    await dataStore.save(seededData);

    const { leaf } = await openLeifView(dataStore);
    const planTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='cycle']");

    if (!planTabButton) {
      throw new Error("Plan tab button was not rendered.");
    }

    planTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const table = leaf.containerEl.querySelector("table.leif-table");
    const headerTexts = Array.from(
      leaf.containerEl.querySelectorAll("table.leif-table thead th")
    ).map((header) => header.textContent?.trim());
    const subjectRows = Array.from(
      leaf.containerEl.querySelectorAll<HTMLElement>("tr[data-subject-id]")
    );
    const upButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "tr[data-subject-id] button[aria-label='Subir']"
    );
    const downButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "tr[data-subject-id] button[aria-label='Descer']"
    );

    expect(table).not.toBeNull();
    expect(headerTexts).toEqual([
      "Ordem",
      "Matéria",
      "Status",
      "Tempo",
      "Etapa",
      "Questões",
      "Ações"
    ]);
    expect(subjectRows.length).toBeGreaterThanOrEqual(2);
    expect(subjectRows[0]?.querySelector(".leif-order-number")?.textContent).toContain("1");
    expect(subjectRows[0]?.querySelector(".leif-cycle-table-title")?.textContent).toBeTruthy();
    expect(subjectRows[0]?.querySelector(".leif-cycle-status.leif-status-active")).not.toBeNull();
    expect(subjectRows[1]?.querySelector(".leif-cycle-status.leif-status-inactive")).not.toBeNull();
    expect(subjectRows[0]?.textContent).toContain("No ciclo");
    expect(subjectRows[1]?.textContent).toContain("Pausada");
    expect(subjectRows[0]?.textContent).toContain("60 min");
    expect(subjectRows[0]?.textContent).toContain("75% (15/20)");
    expect(subjectRows[0]?.querySelector(".leif-key-value")).toBeNull();
    expect(
      subjectRows[0]?.querySelector("button[data-subject-cycle-toggle-id]")?.textContent
    ).toMatch(/Pausar|Ativar/);
    expect(upButton).not.toBeNull();
    expect(downButton).not.toBeNull();
  });

  it("makes subject cycle activation explicit and notifies the user", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const planTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='cycle']");

    if (!planTabButton) {
      throw new Error("Plan tab button was not rendered.");
    }

    planTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const toggleButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "tr[data-subject-id='subject-1'] button[data-subject-cycle-toggle-id='subject-1']"
    );

    if (!toggleButton) {
      throw new Error("Subject cycle toggle was not rendered.");
    }

    expect(toggleButton.textContent).toContain("Pausar");
    toggleButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getRecordedNotices()).toContain("Portuguese saiu do ciclo.");
    expect(leaf.containerEl.textContent).toContain("Ativar");
  });

  it("uses a compact table layout for resources", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);
    const createItem = new CreateStudyItemUseCase(dataStore, factory);
    const item = await createItem.execute({ subjectId: "subject-1", title: "Sintaxe" });

    const { leaf } = await openLeifView(dataStore);
    const itemsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='items']");

    if (!itemsTabButton) {
      throw new Error("Items tab button was not rendered.");
    }

    itemsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const headerTexts = Array.from(
      leaf.containerEl.querySelectorAll("table.leif-table thead th")
    ).map((header) => header.textContent?.trim() ?? "");
    const itemRow = leaf.containerEl.querySelector<HTMLTableRowElement>(
      `tr[data-item-id='${item.id}']`
    );

    expect(headerTexts).toEqual(["Ordem", "Recurso", "Peso", "Questões", "Páginas", "Ações"]);
    expect(leaf.containerEl.querySelector("table.leif-table")).not.toBeNull();
    expect(leaf.containerEl.querySelector(".leif-resource-card")).toBeNull();
    expect(itemRow?.textContent).toContain("Sintaxe");
    expect(itemRow?.querySelector("button[title='Editar']")).not.toBeNull();
  });

  it("keeps session actions and question results inline in the history table", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);
    const registerStudySession = new RegisterStudySessionUseCase(dataStore, factory);

    await registerStudySession.execute({
      id: "session-questions-inline",
      contestId: "contest-1",
      subjectId: "subject-1",
      type: "questions",
      studiedAt: "2026-06-12T20:00:00.000Z",
      pagesOrCount: 20,
      correctAnswers: 15,
      completed: true
    });

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const headerTexts = Array.from(
      leaf.containerEl.querySelectorAll("table.leif-table thead th")
    ).map((header) => header.textContent?.trim() ?? "");
    const questionsRow = leaf.containerEl.querySelector<HTMLTableRowElement>(
      "tr[data-session-id='session-questions-inline']"
    );

    expect(headerTexts).toEqual(["Data", "Estudo", "Tipo", "Resultado", "Ações"]);
    expect(questionsRow?.textContent).toContain("15/20 acertos");
    expect(
      questionsRow?.querySelector("td.leif-actions-cell button[title='Excluir']")
    ).not.toBeNull();
    expect(
      questionsRow?.querySelector("td.leif-session-date-cell button[title='Excluir']")
    ).toBeNull();
  });

  it("filters session history by subject, type and period", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);
    const registerStudySession = new RegisterStudySessionUseCase(dataStore, factory);

    await registerStudySession.execute({
      id: "session-video-constitutional",
      contestId: "contest-1",
      subjectId: "subject-2",
      type: "video",
      studiedAt: "2026-06-13T20:00:00.000Z",
      pagesOrCount: 1,
      completed: true
    });
    await registerStudySession.execute({
      id: "session-questions-portuguese",
      contestId: "contest-1",
      subjectId: "subject-1",
      type: "questions",
      studiedAt: "2026-06-20T20:00:00.000Z",
      pagesOrCount: 20,
      correctAnswers: 15,
      completed: true
    });

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const setFilter = async (name: string, value: string): Promise<void> => {
      const control = leaf.containerEl.querySelector<HTMLInputElement | HTMLSelectElement>(
        `[data-session-filter='${name}']`
      );

      if (!control) {
        throw new Error(`${name} filter was not rendered.`);
      }

      control.value = value;
      control.dispatchEvent(new Event("change"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    };

    expect(leaf.containerEl.querySelector(".leif-session-filters")).not.toBeNull();

    await setFilter("subject", "subject-2");
    expect(
      leaf.containerEl.querySelector("tr[data-session-id='session-video-constitutional']")
    ).not.toBeNull();
    expect(leaf.containerEl.querySelector("tr[data-session-id='session-1']")).toBeNull();

    await setFilter("subject", "");
    await setFilter("type", "questions");
    expect(
      leaf.containerEl.querySelector("tr[data-session-id='session-questions-portuguese']")
    ).not.toBeNull();
    expect(
      leaf.containerEl.querySelector("tr[data-session-id='session-video-constitutional']")
    ).toBeNull();

    await setFilter("type", "");
    await setFilter("from", "2026-06-14");
    await setFilter("to", "2026-06-30");
    expect(
      leaf.containerEl.querySelector("tr[data-session-id='session-questions-portuguese']")
    ).not.toBeNull();
    expect(
      leaf.containerEl.querySelector("tr[data-session-id='session-video-constitutional']")
    ).toBeNull();
  });

  it("keeps contest actions next to the contest name", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const contestsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='contests']");

    if (!contestsTabButton) {
      throw new Error("Contests tab button was not rendered.");
    }

    contestsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const contestCard = leaf.containerEl.querySelector<HTMLElement>(".leif-contest-card");

    expect(leaf.containerEl.querySelector("table.leif-table")).toBeNull();
    expect(contestCard?.querySelector(".leif-contest-card-title")?.textContent).toBeTruthy();
    expect(
      contestCard?.querySelector(
        ".leif-contest-card-header .leif-inline-actions button[title='Editar']"
      )
    ).not.toBeNull();
    expect(contestCard?.querySelector(":scope > .leif-contest-meta")).not.toBeNull();
    expect(contestCard?.querySelector(":scope > .leif-contest-notes")).not.toBeNull();
    expect(contestCard?.querySelector(".leif-contest-meta")?.textContent).not.toContain("ID");
  });

  it("organizes the wall into clear edital, prova and notes sections", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);
    const data = await dataStore.load();
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);
    const subject = data.subjects[0];
    const item = data.studyItems[0];

    if (!activeContest || !subject || !item) {
      throw new Error("Seed data was not created.");
    }

    const updateContestWall = new UpdateContestWallUseCase(
      dataStore,
      new EntityRepositoryFactory(dataStore)
    );
    await updateContestWall.execute({
      contestId: activeContest.id,
      wall: {
        noticeLinks: activeContest.wall.noticeLinks,
        examLinks: activeContest.wall.examLinks,
        notes: activeContest.wall.notes,
        subjectSnapshots: [
          {
            subjectId: subject.id,
            weight: 2,
            score: 8,
            targetItems: [item.id]
          }
        ]
      }
    });

    const { leaf } = await openLeifView(dataStore);
    const wallTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='wall']");

    if (!wallTabButton) {
      throw new Error("Wall tab button was not rendered.");
    }

    wallTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const wallCards = Array.from(leaf.containerEl.querySelectorAll<HTMLElement>(".leif-wall-card"));
    const titles = wallCards.map((card) => card.querySelector("h3")?.textContent?.trim() ?? "");

    expect(titles).toEqual(["Notas", "Edital", "Prova"]);
    expect(leaf.containerEl.querySelector(".leif-wall-primary")).not.toBeNull();
    expect(leaf.containerEl.querySelector(".leif-wall-reference-grid")).not.toBeNull();
    expect(leaf.containerEl.querySelectorAll(".leif-wall-reference-card")).toHaveLength(2);
    expect(leaf.containerEl.querySelector(".leif-wall-layout")).toBeNull();
    expect(leaf.containerEl.querySelector(".leif-wall-links")).toBeNull();
    expect(leaf.containerEl.querySelector(".leif-wall-card-wide")).toBeNull();
    expect(leaf.containerEl.querySelector("button.leif-wall-save")).not.toBeNull();
    expect(leaf.containerEl.querySelector(".leif-wall-snapshot-card")).not.toBeNull();
    expect(leaf.containerEl.querySelector(".leif-wall-snapshot-card .leif-metric")).not.toBeNull();
    expect(leaf.containerEl.querySelector(".leif-wall-snapshot-list table.leif-table")).toBeNull();
    expect(leaf.containerEl.textContent).toContain("Salvar mural");
  });

  it("opens creation forms inline instead of using modals", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const cases: Array<{ tab: string; addLabel: string; formTitle: string }> = [
      { tab: "cycle", addLabel: "Nova matéria", formTitle: "Nova matéria" },
      { tab: "items", addLabel: "Novo item", formTitle: "Novo recurso" },
      { tab: "topics", addLabel: "Novo assunto", formTitle: "Novo assunto" },
      { tab: "sessions", addLabel: "Nova sessão", formTitle: "Novo registro" },
      { tab: "contests", addLabel: "Novo concurso", formTitle: "Novo concurso" }
    ];

    for (const testCase of cases) {
      const tabButton = leaf.containerEl.querySelector<HTMLButtonElement>(
        `[data-tab='${testCase.tab}']`
      );
      if (!tabButton) {
        throw new Error(`${testCase.tab} tab button was not rendered.`);
      }

      tabButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const addButton = leaf.containerEl.querySelector<HTMLButtonElement>(
        `button[aria-label='${testCase.addLabel}']`
      );
      if (!addButton) {
        throw new Error(`${testCase.addLabel} button was not rendered.`);
      }

      addButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const form = leaf.containerEl.querySelector<HTMLFormElement>("form.leif-card");
      expect(document.body.querySelector(".modal")).toBeNull();
      expect(form?.textContent).toContain(testCase.formTitle);
    }
  });

  it("uses clear form controls when editing contest name and notes", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const contestsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='contests']");

    if (!contestsTabButton) {
      throw new Error("Contests tab button was not rendered.");
    }

    contestsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const editButton = leaf.containerEl.querySelector<HTMLButtonElement>("button[title='Editar']");

    if (!editButton) {
      throw new Error("Edit contest button was not rendered.");
    }

    editButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const editingCard = leaf.containerEl.querySelector<HTMLElement>(
      ".leif-contest-card.is-editing"
    );
    const nameInput = editingCard?.querySelector<HTMLInputElement>(
      "input[placeholder='Nome do concurso']"
    );
    const notesTextarea = editingCard?.querySelector<HTMLTextAreaElement>(
      "textarea[placeholder='Notas do concurso']"
    );

    expect(editingCard?.querySelector(".leif-contest-edit-form")).not.toBeNull();
    expect(nameInput).not.toBeNull();
    expect(notesTextarea).not.toBeNull();
    expect(notesTextarea?.rows).toBeGreaterThanOrEqual(4);
    expect(nameInput?.closest(".setting-item")).toBeNull();
    expect(notesTextarea?.closest(".setting-item")).toBeNull();
    expect(editingCard?.textContent).toMatch(/(Estudando agora|Guardado)/);
  });

  it("edits exam planning metadata and surfaces it on the dashboard", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);
    const data = await dataStore.load();
    const activeContestId = data.activeContestId;

    const { leaf } = await openLeifView(dataStore);
    const contestsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='contests']");

    if (!contestsTabButton || !activeContestId) {
      throw new Error("Contests tab button or active contest was not rendered.");
    }

    contestsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const activeContestCard = leaf.containerEl.querySelector<HTMLElement>(
      `[data-contest-card-id='${activeContestId}']`
    );
    const editButton =
      activeContestCard?.querySelector<HTMLButtonElement>("button[title='Editar']");

    if (!editButton) {
      throw new Error("Active contest edit button was not rendered.");
    }

    editButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const editingCard = leaf.containerEl.querySelector<HTMLElement>(
      `[data-contest-card-id='${activeContestId}'].is-editing`
    );
    const examDateInput = editingCard?.querySelector<HTMLInputElement>(
      "input[placeholder='Data da prova']"
    );
    const boardInput = editingCard?.querySelector<HTMLInputElement>("input[placeholder='Banca']");
    const weeklyHoursInput = editingCard?.querySelector<HTMLInputElement>(
      "input[placeholder='Horas por semana']"
    );
    const questionGoalInput = editingCard?.querySelector<HTMLInputElement>(
      "input[placeholder='Questões por semana']"
    );
    const saveButton = editingCard?.querySelector<HTMLButtonElement>("button[title='Salvar']");

    if (!examDateInput || !boardInput || !weeklyHoursInput || !questionGoalInput || !saveButton) {
      throw new Error("Exam planning controls were not rendered.");
    }

    examDateInput.value = "2027-03-21";
    boardInput.value = "FGV";
    weeklyHoursInput.value = "20";
    questionGoalInput.value = "300";
    saveButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const updatedData = await dataStore.load();
    expect(
      updatedData.contests.find((contest) => contest.id === activeContestId)?.examPlan
    ).toMatchObject({
      examDate: "2027-03-21",
      board: "FGV",
      weeklyStudyHours: 20,
      weeklyQuestionGoal: 300
    });

    const todayTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='dashboard']");

    if (!todayTabButton) {
      throw new Error("Dashboard tab button was not rendered.");
    }

    todayTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const examPanel = leaf.containerEl.querySelector<HTMLElement>(".leif-exam-plan");
    expect(examPanel?.textContent).toContain("Prova");
    expect(examPanel?.textContent).toContain("FGV");
    expect(examPanel?.textContent).toContain("20 h/semana");
    expect(examPanel?.textContent).toContain("300 questões/semana");
    expect(examPanel?.textContent).toContain("dias");
  });

  it("formats session history dates with day, month and year", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(leaf.containerEl.textContent).toContain("11/06/2026");
    expect(leaf.containerEl.textContent).not.toMatch(/\b\d{2}:\d{2}\b/);
    expect(leaf.containerEl.textContent).toContain("PDF");
  });

  it("shows cycle advance button in sessions tab", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const cycleContext = leaf.containerEl.querySelector(".leif-cycle-context");
    const finishButton = Array.from(cycleContext?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Marcar como estudado")
    );

    expect(finishButton).toBeDefined();
    expect(leaf.containerEl.querySelector(".leif-cycle-action")).toBeNull();
  });

  it("shows the recommended subject name in the cycle-advance notice", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const finishButton = Array.from(leaf.containerEl.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Marcar como estudado")
    ) as HTMLButtonElement | undefined;

    if (!finishButton) {
      throw new Error("Cycle advance button was not rendered.");
    }

    finishButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const notices = getRecordedNotices();
    const advanceNotice = notices.find((notice) => notice.startsWith("Pronto."));

    expect(advanceNotice).toBeDefined();
    expect(advanceNotice).not.toContain("—");
    expect(advanceNotice).toContain("Portuguese");
  });

  it("deletes a session from recent history", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const deleteButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "[data-session-delete-id='session-1']"
    );

    if (!deleteButton) {
      throw new Error("Delete session button was not rendered.");
    }

    deleteButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const confirmButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "[data-session-confirm-delete-id='session-1']"
    );
    if (!confirmButton) {
      throw new Error("Confirm button was not rendered.");
    }
    confirmButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(leaf.containerEl.textContent).not.toContain("11/06/2026");
    expect(leaf.containerEl.querySelector("[data-session-delete-id='session-1']")).toBeNull();
  });

  it("creates a questions session from the sessions tab form", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const createTopic = new CreateTopicUseCase(dataStore, factory);
    const linkNotebook = new LinkQuestionNotebookUseCase(dataStore, factory);
    await createTopic.execute({
      id: "topic-1",
      subjectId: "subject-1",
      name: "Orações subordinadas"
    });
    await linkNotebook.execute({
      topicId: "topic-1",
      questionNotebook: {
        id: "notebook-1",
        name: "Caderno",
        url: "https://example.com",
        solvedQuestions: 0,
        correctAnswers: 0
      }
    });

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const newButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button[aria-label='Nova sessão']"
    );

    if (!newButton) {
      throw new Error("New session button was not rendered.");
    }

    newButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = leaf.containerEl.querySelector<HTMLFormElement>("form.leif-card");

    if (!form) {
      throw new Error("Session form was not rendered.");
    }

    expect(form.textContent).toContain("Tipo de registro");
    expect(form.textContent).toContain("Páginas lidas");

    const selects = form.querySelectorAll<HTMLSelectElement>("select");
    const inputs = form.querySelectorAll<HTMLInputElement>("input");

    const subjectSelect = selects[0];
    const typeSelect = selects[1];
    const topicSelect = selects[3];
    const countInput = inputs[0];
    const correctInput = inputs[1];
    const dateInput = inputs[2];

    if (
      !subjectSelect ||
      !typeSelect ||
      !topicSelect ||
      !countInput ||
      !correctInput ||
      !dateInput
    ) {
      throw new Error("Form controls were not found.");
    }

    subjectSelect.value = "subject-1";
    subjectSelect.dispatchEvent(new Event("change"));
    topicSelect.value = "topic-1";
    typeSelect.value = "questions";
    typeSelect.dispatchEvent(new Event("change"));
    expect(form.textContent).toContain("Questões resolvidas");
    expect(form.textContent).toContain("Acertos nas questões");
    countInput.value = "20";
    correctInput.value = "15";
    dateInput.value = "2026-06-11";

    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const data = await dataStore.load();
    const questionsSessions = data.studySessions.filter(
      (session) => session.type === "questions" && session.contestId === "contest-1"
    );

    expect(questionsSessions).toHaveLength(1);
    expect(questionsSessions[0]).toMatchObject({
      type: "questions",
      subjectId: "subject-1",
      topicId: "topic-1",
      pagesOrCount: 20,
      correctAnswers: 15
    });

    const topic = data.topics.find((t) => t.id === "topic-1");
    expect(topic?.questionNotebook).toMatchObject({
      solvedQuestions: 20,
      correctAnswers: 15
    });
  });

  it("shows assunto progress from sessions even without a linked question notebook", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const createTopic = new CreateTopicUseCase(dataStore, factory);
    const registerSession = new RegisterStudySessionUseCase(dataStore, factory);
    await createTopic.execute({
      id: "topic-progress-sessions",
      subjectId: "subject-1",
      name: "Regência"
    });
    await registerSession.execute({
      id: "session-topic-questions",
      contestId: "contest-1",
      subjectId: "subject-1",
      topicId: "topic-progress-sessions",
      type: "questions",
      studiedAt: "2026-06-11T20:00:00.000Z",
      pagesOrCount: 20,
      correctAnswers: 16,
      completed: true
    });
    await registerSession.execute({
      id: "session-topic-pdf",
      contestId: "contest-1",
      subjectId: "subject-1",
      topicId: "topic-progress-sessions",
      type: "pdf",
      studiedAt: "2026-06-12T20:00:00.000Z",
      pagesOrCount: 12,
      completed: true
    });

    const { leaf } = await openLeifView(dataStore);
    const topicsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='topics']");

    if (!topicsTabButton) {
      throw new Error("Topics tab button was not rendered.");
    }

    topicsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const topicRow = leaf.containerEl.querySelector<HTMLTableRowElement>(
      "tr[data-topic-id='topic-progress-sessions']"
    );

    expect(topicRow?.textContent).toContain("16/20 acertos");
    expect(topicRow?.textContent).toContain("12 pág. PDF");
    expect(topicRow?.textContent).not.toContain("0 resolvidas");
  });

  it("creates a questions session when the count is greater than zero", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const createTopic = new CreateTopicUseCase(dataStore, factory);
    const linkNotebook = new LinkQuestionNotebookUseCase(dataStore, factory);
    await createTopic.execute({
      id: "topic-1",
      subjectId: "subject-1",
      name: "Orações subordinadas"
    });
    await linkNotebook.execute({
      topicId: "topic-1",
      questionNotebook: {
        id: "notebook-1",
        name: "Caderno",
        url: "https://example.com",
        solvedQuestions: 0,
        correctAnswers: 0
      }
    });

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const newButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button[aria-label='Nova sessão']"
    );

    if (!newButton) {
      throw new Error("New session button was not rendered.");
    }

    newButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = leaf.containerEl.querySelector<HTMLFormElement>("form.leif-card");

    if (!form) {
      throw new Error("Session form was not rendered.");
    }

    const selects = form.querySelectorAll<HTMLSelectElement>("select");
    const inputs = form.querySelectorAll<HTMLInputElement>("input");

    const typeSelect = selects[1];
    const countInput = inputs[0];
    const correctInput = inputs[1];
    const dateInput = inputs[2];

    if (!typeSelect || !countInput || !correctInput || !dateInput) {
      throw new Error("Form controls were not found.");
    }

    typeSelect.value = "questions";
    typeSelect.dispatchEvent(new Event("change"));
    countInput.value = "20";
    correctInput.value = "15";
    dateInput.value = "2026-06-11";

    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const data = await dataStore.load();
    const questionsSessions = data.studySessions.filter(
      (session) => session.type === "questions" && session.contestId === "contest-1"
    );

    expect(questionsSessions).toHaveLength(1);
    expect(questionsSessions[0]).toMatchObject({
      type: "questions",
      subjectId: "subject-1",
      pagesOrCount: 20,
      correctAnswers: 15
    });
    expect(leaf.containerEl.querySelector(".leif-session-feedback")?.textContent).toContain(
      "Registro salvo"
    );
  });

  it("places the new session action with the history and keeps visual feedback after saving", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const topHeader = leaf.containerEl.querySelector<HTMLElement>(":scope .leif-section-header");
    const historyCard = Array.from(
      leaf.containerEl.querySelectorAll<HTMLElement>(".leif-card")
    ).find((card) => card.textContent?.includes("Histórico de sessões"));
    const newButton = historyCard?.querySelector<HTMLButtonElement>(
      "button[aria-label='Nova sessão']"
    );

    expect(topHeader?.querySelector("button[aria-label='Nova sessão']")).toBeNull();
    expect(newButton).not.toBeNull();

    newButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = leaf.containerEl.querySelector<HTMLFormElement>("form.leif-card");
    const countInput = form?.querySelector<HTMLInputElement>("input[type='number']");
    const dateInput = Array.from(form?.querySelectorAll<HTMLInputElement>("input") ?? []).find(
      (input) => input.type === "date"
    );

    if (!form || !countInput || !dateInput) {
      throw new Error("Session form controls were not rendered.");
    }

    countInput.value = "7";
    dateInput.value = "2026-06-12";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(leaf.containerEl.querySelector("form.leif-card")).toBeNull();
    expect(leaf.containerEl.querySelector(".leif-session-feedback")?.textContent).toContain(
      "Registro salvo"
    );
    expect(leaf.containerEl.querySelector(".leif-session-feedback")?.textContent).toContain("PDF");
    expect(leaf.containerEl.querySelector(".leif-session-feedback")?.textContent).toContain(
      "Portuguese"
    );
  });

  it("rejects a questions session form submission when count is 0", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const createTopic = new CreateTopicUseCase(dataStore, factory);
    const linkNotebook = new LinkQuestionNotebookUseCase(dataStore, factory);
    await createTopic.execute({
      id: "topic-1",
      subjectId: "subject-1",
      name: "Orações subordinadas"
    });
    await linkNotebook.execute({
      topicId: "topic-1",
      questionNotebook: {
        id: "notebook-1",
        name: "Caderno",
        url: "https://example.com",
        solvedQuestions: 0,
        correctAnswers: 0
      }
    });

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const newButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button[aria-label='Nova sessão']"
    );

    if (!newButton) {
      throw new Error("New session button was not rendered.");
    }

    newButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = leaf.containerEl.querySelector<HTMLFormElement>("form.leif-card");

    if (!form) {
      throw new Error("Session form was not rendered.");
    }

    const selects = form.querySelectorAll<HTMLSelectElement>("select");
    const inputs = form.querySelectorAll<HTMLInputElement>("input");

    const typeSelect = selects[1];
    const countInput = inputs[0];
    const correctInput = inputs[1];
    const dateInput = inputs[2];

    if (!typeSelect || !countInput || !correctInput || !dateInput) {
      throw new Error("Form controls were not found.");
    }

    typeSelect.value = "questions";
    typeSelect.dispatchEvent(new Event("change"));
    countInput.value = "0";
    correctInput.value = "0";
    dateInput.value = "2026-06-11";

    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const data = await dataStore.load();
    const questionsSessions = data.studySessions.filter(
      (session) => session.type === "questions" && session.contestId === "contest-1"
    );

    expect(questionsSessions).toHaveLength(0);
  });

  it("shows question accuracy inline in the session result column", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const registerStudySession = new RegisterStudySessionUseCase(dataStore, factory);
    const createTopic = new CreateTopicUseCase(dataStore, factory);
    const linkNotebook = new LinkQuestionNotebookUseCase(dataStore, factory);
    await createTopic.execute({
      id: "topic-1",
      subjectId: "subject-1",
      name: "Orações subordinadas"
    });
    await linkNotebook.execute({
      topicId: "topic-1",
      questionNotebook: {
        id: "notebook-1",
        name: "Caderno",
        url: "https://example.com",
        solvedQuestions: 0,
        correctAnswers: 0
      }
    });
    await registerStudySession.execute({
      id: "session-questions-1",
      contestId: "contest-1",
      subjectId: "subject-1",
      topicId: "topic-1",
      type: "questions",
      studiedAt: "2026-06-12T20:00:00.000Z",
      pagesOrCount: 20,
      correctAnswers: 15,
      completed: true
    });

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const tableRows = leaf.containerEl.querySelectorAll("table.leif-table tbody tr");
    expect(tableRows.length).toBeGreaterThanOrEqual(2);

    const findRow = (sessionId: string): HTMLTableRowElement => {
      const row = leaf.containerEl.querySelector<HTMLTableRowElement>(
        `tr[data-session-id='${sessionId}']`
      );
      if (!row) {
        throw new Error(`Row for session ${sessionId} was not rendered.`);
      }
      return row;
    };

    const questionsRow = findRow("session-questions-1");
    const pdfRow = findRow("session-1");

    const questionsCells = questionsRow.querySelectorAll("td");
    const pdfCells = pdfRow.querySelectorAll("td");

    const headerCells = leaf.containerEl.querySelectorAll("table.leif-table thead th");
    const headerTexts = Array.from(headerCells).map((cell) => cell.textContent?.trim() ?? "");
    const resultColumnIndex = headerTexts.indexOf("Resultado");
    expect(headerTexts).toEqual(["Data", "Estudo", "Tipo", "Resultado", "Ações"]);
    expect(questionsCells.length).toBe(pdfCells.length);
    expect(questionsCells[resultColumnIndex]?.textContent).toContain("15/20 acertos (75%)");
  });

  it("uses user-facing labels for the session form type select", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const newButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button[aria-label='Nova sessão']"
    );

    if (!newButton) {
      throw new Error("New session button was not rendered.");
    }

    newButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = leaf.containerEl.querySelector<HTMLFormElement>("form.leif-card");

    if (!form) {
      throw new Error("Session form was not rendered.");
    }

    const selects = form.querySelectorAll<HTMLSelectElement>("select");
    const typeSelect = selects[1];

    if (!typeSelect) {
      throw new Error("Type select was not found.");
    }

    const labels = Array.from(typeSelect.options).map((option) => option.textContent ?? "");
    const values = Array.from(typeSelect.options).map((option) => option.value);

    expect(labels).toEqual(["PDF", "Vídeo", "Questões"]);
    expect(values).toEqual(["pdf", "video", "questions"]);
  });

  it("shows pages readed vs total and a completion check for items in the items tab", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const createItem = new CreateStudyItemUseCase(dataStore, factory);
    const updateItem = new UpdateStudyItemUseCase(dataStore, factory);
    const registerSession = new RegisterStudySessionUseCase(dataStore, factory);

    const itemA = await createItem.execute({ subjectId: "subject-1", title: "Sintaxe" });
    await updateItem.execute({ itemId: itemA.id, totalPages: 100 });
    const itemB = await createItem.execute({ subjectId: "subject-1", title: "Pontuação" });
    await updateItem.execute({ itemId: itemB.id, totalPages: 50 });

    await registerSession.execute({
      id: "session-pdf-1",
      contestId: "contest-1",
      subjectId: "subject-1",
      studyItemId: itemA.id,
      type: "pdf",
      studiedAt: "2026-06-11T20:00:00.000Z",
      pagesOrCount: 100,
      completed: true
    });

    const { leaf } = await openLeifView(dataStore);
    const itemsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='items']");

    if (!itemsTabButton) {
      throw new Error("Items tab button was not rendered.");
    }

    itemsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const completedRow = leaf.containerEl.querySelector<HTMLElement>(
      `tr[data-item-id='${itemA.id}']`
    );
    const partialRow = leaf.containerEl.querySelector<HTMLElement>(
      `tr[data-item-id='${itemB.id}']`
    );

    if (!completedRow || !partialRow) {
      throw new Error("Item rows were not rendered.");
    }

    expect(completedRow.textContent).toContain("100/100 (100%)");
    expect(completedRow.textContent).toContain("Concluído");
    expect(partialRow.textContent).toContain("0/50 (0%)");
    expect(partialRow.textContent).not.toContain("Concluído");

    const completedProgressBar = completedRow.querySelector(".leif-progress-bar");
    const partialProgressBar = partialRow.querySelector(".leif-progress-bar");
    const completeStatus = completedRow.querySelector(".leif-progress-complete");
    expect(completedProgressBar).toBeNull();
    expect(partialProgressBar).not.toBeNull();
    expect(completeStatus?.textContent).toContain("Concluído");
    expect(completeStatus?.querySelector(".leif-icon")).not.toBeNull();
    expect(partialProgressBar?.querySelector<HTMLElement>(".leif-progress-fill")?.style.width).toBe(
      "0%"
    );
  });

  it("edits an item title from the items tab", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const createItem = new CreateStudyItemUseCase(dataStore, factory);
    const item = await createItem.execute({ subjectId: "subject-1", title: "Sintaxe" });

    const { leaf } = await openLeifView(dataStore);
    const itemsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='items']");

    if (!itemsTabButton) {
      throw new Error("Items tab button was not rendered.");
    }

    itemsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const itemRow = leaf.containerEl.querySelector<HTMLElement>(`tr[data-item-id='${item.id}']`);
    const editButton = itemRow?.querySelector<HTMLButtonElement>("button[title='Editar']");

    if (!editButton) {
      throw new Error("Edit button was not rendered.");
    }

    editButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const editingRow = leaf.containerEl.querySelector<HTMLElement>("tr.leif-editing-row");
    const titleInput = editingRow?.querySelector<HTMLInputElement>("input[placeholder='Título']");
    const saveButton = editingRow?.querySelector<HTMLButtonElement>("button[title='Salvar']");

    if (!titleInput || !saveButton) {
      throw new Error("Title edit controls were not rendered.");
    }

    titleInput.value = "Concordância";
    saveButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const updatedData = await dataStore.load();
    expect(updatedData.studyItems.find((candidate) => candidate.id === item.id)?.title).toBe(
      "Concordância"
    );
    expect(leaf.containerEl.textContent).toContain("Concordância");
  });

  it("shows a progress bar for pdf sessions in the sessions history table", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const createItem = new CreateStudyItemUseCase(dataStore, factory);
    const updateItem = new UpdateStudyItemUseCase(dataStore, factory);
    const registerSession = new RegisterStudySessionUseCase(dataStore, factory);

    const itemPdf = await createItem.execute({ subjectId: "subject-1", title: "Constituição" });
    await updateItem.execute({ itemId: itemPdf.id, totalPages: 200 });

    await registerSession.execute({
      id: "session-pdf-2",
      contestId: "contest-1",
      subjectId: "subject-1",
      studyItemId: itemPdf.id,
      type: "pdf",
      studiedAt: "2026-06-12T20:00:00.000Z",
      pagesOrCount: 50,
      completed: true
    });

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const pdfRow = leaf.containerEl.querySelector<HTMLTableRowElement>(
      "tr[data-session-id='session-pdf-2']"
    );

    if (!pdfRow) {
      throw new Error("PDF session row was not rendered.");
    }

    expect(pdfRow.textContent).toContain("50/200 (25%)");
    const progressBar = pdfRow.querySelector(".leif-progress-bar");
    expect(progressBar).not.toBeNull();
    expect(progressBar?.querySelector<HTMLElement>(".leif-progress-fill")?.style.width).toBe("25%");
  });

  it("labels editable session result inputs clearly", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);
    const registerSession = new RegisterStudySessionUseCase(dataStore, factory);

    await registerSession.execute({
      id: "session-edit-labels",
      contestId: "contest-1",
      subjectId: "subject-1",
      type: "questions",
      studiedAt: "2026-06-12T20:00:00.000Z",
      pagesOrCount: 20,
      correctAnswers: 15,
      completed: true
    });

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const row = leaf.containerEl.querySelector<HTMLTableRowElement>(
      "tr[data-session-id='session-edit-labels']"
    );
    const editButton = row?.querySelector<HTMLButtonElement>("button[title='Editar']");

    if (!editButton) {
      throw new Error("Edit session button was not rendered.");
    }

    editButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const editingRow = leaf.containerEl.querySelector<HTMLTableRowElement>(
      "tr[data-session-id='session-edit-labels'].leif-editing-row"
    );
    const resultEditor = editingRow?.querySelector<HTMLElement>(".leif-session-result-editor");

    expect(resultEditor?.textContent).toContain("Questões resolvidas");
    expect(resultEditor?.textContent).toContain("Acertos");
    expect(resultEditor?.querySelector("input[placeholder='Questões resolvidas']")).not.toBeNull();
    expect(resultEditor?.querySelector("input[placeholder='Acertos']")).not.toBeNull();
  });

  it("keeps resource expansion read-only and moves add-material form to edit mode", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const createItem = new CreateStudyItemUseCase(dataStore, factory);
    const addResource = new AddStudyItemResourceReferenceUseCase(dataStore, factory);

    const itemRes = await createItem.execute({ subjectId: "subject-1", title: "Gramática" });
    await addResource.execute({
      studyItemId: itemRes.id,
      resourceReference: {
        id: "res-1",
        title: "Apostila A",
        type: "pdf",
        url: "https://example.com"
      }
    });

    const { leaf } = await openLeifView(dataStore);
    const itemsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='items']");

    if (!itemsTabButton) {
      throw new Error("Items tab button was not rendered.");
    }

    itemsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const expandButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      `tr[data-item-id='${itemRes.id}'] button[title='Expandir']`
    );

    if (!expandButton) {
      throw new Error("Expand button was not rendered.");
    }

    expandButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const detailRow = leaf.containerEl.querySelector(".leif-resource-detail");
    const materialInfo = detailRow?.querySelector(".leif-material-info");
    expect(detailRow?.textContent).toContain("Materiais deste recurso");
    expect(materialInfo?.querySelector(".leif-material-type")?.textContent).toBe("PDF");
    expect(materialInfo?.querySelector(".leif-material-title")?.textContent).toBe("Apostila A");
    expect(detailRow?.querySelector("form.leif-resource-material-form")).toBeNull();
    expect(detailRow?.querySelector("button[data-resource-add-material-id]")).toBeNull();

    const materialLink = detailRow?.querySelector<HTMLAnchorElement>("a.leif-material-title");
    expect(materialLink?.textContent).toBe("Apostila A");
    expect(materialLink?.href).toBe("https://example.com/");
    expect(detailRow?.querySelector("a.leif-material-open-link")).toBeNull();

    const editButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      `tr[data-item-id='${itemRes.id}'] button[title='Editar']`
    );

    if (!editButton) {
      throw new Error("Edit button was not rendered.");
    }

    editButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const editMaterialsRow = leaf.containerEl.querySelector(".leif-resource-edit-materials");
    expect(editMaterialsRow?.textContent).toContain("Materiais do recurso");
    expect(editMaterialsRow?.textContent).toContain("Adicionar novo material");
    expect(editMaterialsRow?.textContent).toContain(
      "Use esta área para anexar PDF, vídeo ou link ao recurso em edição."
    );
    expect(editMaterialsRow?.querySelector(".setting-item")).toBeNull();

    const materialEditor = editMaterialsRow?.querySelector<HTMLElement>(
      "[data-resource-material-editor-id='res-1']"
    );
    const materialTitleInput = materialEditor?.querySelector<HTMLInputElement>(
      "input[placeholder='Título']"
    );
    const materialUrlInput = materialEditor?.querySelector<HTMLInputElement>(
      "input[placeholder='URL']"
    );
    const saveMaterialButton = materialEditor?.querySelector<HTMLButtonElement>(
      "button[data-resource-save-material-id='res-1']"
    );

    if (!materialTitleInput || !materialUrlInput || !saveMaterialButton) {
      throw new Error("Existing material editor was not rendered.");
    }

    materialTitleInput.value = "Apostila revisada";
    materialUrlInput.value = "https://example.com/revisada";
    saveMaterialButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    let updatedData = await dataStore.load();
    let updatedItem = updatedData.studyItems.find((candidate) => candidate.id === itemRes.id);
    expect(updatedItem?.resourceReferences?.[0]).toMatchObject({
      id: "res-1",
      title: "Apostila revisada",
      type: "pdf",
      url: "https://example.com/revisada"
    });

    const deleteButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button[data-resource-delete-material-id='res-1']"
    );

    if (!deleteButton) {
      throw new Error("Delete material button was not rendered.");
    }

    deleteButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    updatedData = await dataStore.load();
    updatedItem = updatedData.studyItems.find((candidate) => candidate.id === itemRes.id);
    expect(updatedItem?.resourceReferences).toHaveLength(0);

    const form = editMaterialsRow?.querySelector("form.leif-resource-material-form");
    const typeSelect = form?.querySelector("select");
    const labels = Array.from(typeSelect?.querySelectorAll("option") ?? []).map(
      (option) => option.textContent?.trim() ?? ""
    );

    expect(labels).toEqual(["PDF", "Vídeo", "Link"]);
  });

  it("explains the resources tab and keeps linked materials visually lightweight", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const createItem = new CreateStudyItemUseCase(dataStore, factory);
    const addResource = new AddStudyItemResourceReferenceUseCase(dataStore, factory);

    const itemRes = await createItem.execute({ subjectId: "subject-1", title: "Gramática" });
    await addResource.execute({
      studyItemId: itemRes.id,
      resourceReference: {
        id: "res-1",
        title: "Apostila A",
        type: "pdf",
        url: "https://example.com"
      }
    });

    const { leaf } = await openLeifView(dataStore);
    const itemsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='items']");

    if (!itemsTabButton) {
      throw new Error("Items tab button was not rendered.");
    }

    itemsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(leaf.containerEl.textContent).toContain("Guarde materiais de estudo por matéria");

    const expandButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      `tr[data-item-id='${itemRes.id}'] button[title='Expandir']`
    );

    if (!expandButton) {
      throw new Error("Expand button was not rendered.");
    }

    expandButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const detail = leaf.containerEl.querySelector<HTMLElement>(".leif-resource-detail");
    const materialRow = detail?.querySelector<HTMLElement>(".leif-detail-list-item");

    expect(detail?.textContent).toContain("Materiais deste recurso");
    expect(materialRow?.querySelector(".leif-material-type")?.textContent).toBe("PDF");
    const materialLink = materialRow?.querySelector<HTMLAnchorElement>("a.leif-material-title");
    expect(materialLink?.textContent).toBe("Apostila A");
    expect(materialLink?.href).toBe("https://example.com/");
    expect(materialRow?.textContent).not.toContain("Abrir");
    expect(materialRow?.classList.contains("leif-material-row")).toBe(true);
  });

  it("notifies when a contest becomes active", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const contestsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='contests']");

    if (!contestsTabButton) {
      throw new Error("Contests tab button was not rendered.");
    }

    contestsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const activateButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "[data-contest-id='contest-2']"
    );

    if (!activateButton) {
      throw new Error("Activate contest button was not rendered.");
    }

    activateButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getRecordedNotices()).toContain("SEFAZ agora é o concurso ativo.");
    expect(leaf.containerEl.textContent).toContain("Estudando: SEFAZ");
  });

  it("gives the contest wall notes field enough room to write", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const wallTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='wall']");

    if (!wallTabButton) {
      throw new Error("Wall tab button was not rendered.");
    }

    wallTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const notes = leaf.containerEl.querySelector<HTMLTextAreaElement>(
      "textarea[placeholder='Notas do concurso']"
    );

    expect(notes?.rows).toBeGreaterThanOrEqual(8);
    expect(notes?.classList.contains("leif-wall-notes")).toBe(true);
    expect(notes?.closest(".setting-item")).toBeNull();
    expect(notes?.closest(".leif-field-stack")).not.toBeNull();
    expect(leaf.containerEl.textContent).toContain("anotações úteis do concurso ativo");
  });

  it("shows the subject picker as a simple label and select in edital and resources", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const tabs = ["topics", "items"];

    for (const tab of tabs) {
      const tabButton = leaf.containerEl.querySelector<HTMLButtonElement>(`[data-tab='${tab}']`);

      if (!tabButton) {
        throw new Error(`${tab} tab button was not rendered.`);
      }

      tabButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const picker = leaf.containerEl.querySelector<HTMLElement>(".leif-subject-picker");
      const label = picker?.querySelector<HTMLElement>(".leif-subject-picker-label");
      const select = picker?.querySelector<HTMLSelectElement>("select");

      expect(picker).not.toBeNull();
      expect(label?.textContent).toBe("Matéria");
      expect(select?.value).toBeTruthy();
      expect(picker?.classList.contains("leif-toolbar")).toBe(false);
      expect(picker?.querySelector(".setting-item")).toBeNull();
    }
  });

  it("assigns a question notebook to a topic from the topics tab", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);
    const originalOpen = window.open;
    const openSpy = vi.fn();
    window.open = openSpy;

    const createTopic = new CreateTopicUseCase(dataStore, factory);
    await createTopic.execute({
      id: "topic-caderno",
      subjectId: "subject-1",
      name: "Orações coordenadas"
    });

    const { leaf } = await openLeifView(dataStore);
    const topicsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='topics']");

    if (!topicsTabButton) {
      throw new Error("Topics tab button was not rendered.");
    }

    topicsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const topicRow = leaf.containerEl.querySelector<HTMLTableRowElement>(
      "tr[data-topic-id='topic-caderno']"
    );
    expect(topicRow?.querySelector("button[title='Expandir']")).toBeNull();
    expect(topicRow?.querySelector("button[title='Recolher']")).toBeNull();
    expect(leaf.containerEl.querySelector(".leif-topic-detail")).toBeNull();

    const editButton = topicRow?.querySelector<HTMLButtonElement>("button[title='Editar']");

    if (!editButton) {
      throw new Error("Topic edit button was not rendered.");
    }

    editButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const editingRow = leaf.containerEl.querySelector<HTMLTableRowElement>(
      "tr[data-topic-id='topic-caderno'].leif-editing-row"
    );
    const notebookEditor = editingRow?.querySelector<HTMLElement>(".leif-topic-notebook-editor");
    const nameInput = editingRow?.querySelector<HTMLInputElement>(
      "input[placeholder='Nome do assunto']"
    );
    const notebookName = editingRow?.querySelector<HTMLInputElement>(
      "input[placeholder='Nome do caderno']"
    );
    const notebookUrl = editingRow?.querySelector<HTMLInputElement>(
      "input[placeholder='URL do caderno']"
    );
    const saveButton = editingRow?.querySelector<HTMLButtonElement>("button[title='Salvar']");

    if (!nameInput || !notebookName || !notebookUrl || !saveButton) {
      throw new Error("Topic editing controls were not rendered.");
    }
    expect(nameInput.classList.contains("leif-topic-name-input")).toBe(true);
    expect(notebookEditor?.textContent).toContain("Caderno de questões");
    expect(notebookEditor?.classList.contains("leif-topic-notebook-editor-stacked")).toBe(true);
    expect(notebookUrl.closest(".leif-url-field")).not.toBeNull();

    nameInput.value = "Orações coordenadas";
    notebookName.value = "Tec Concursos - Coordenadas";
    notebookUrl.value = "https://tec.example.com/coordenadas";
    saveButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const data = await dataStore.load();
    expect(
      data.topics.find((topic) => topic.id === "topic-caderno")?.questionNotebook
    ).toMatchObject({
      name: "Tec Concursos - Coordenadas",
      url: "https://tec.example.com/coordenadas",
      solvedQuestions: 0,
      correctAnswers: 0
    });
    expect(leaf.containerEl.textContent).toContain("Tec Concursos - Coordenadas");

    const notebookLink = leaf.containerEl.querySelector<HTMLAnchorElement>(
      "a[data-topic-notebook-url='topic-caderno']"
    );

    if (!notebookLink) {
      throw new Error("Notebook link was not rendered.");
    }

    notebookLink.click();
    expect(openSpy).toHaveBeenCalledWith(
      "https://tec.example.com/coordenadas",
      "_blank",
      "noopener"
    );
    window.open = originalOpen;
  });

  it("does not expose ordering controls for topics", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const createTopic = new CreateTopicUseCase(dataStore, factory);
    await createTopic.execute({
      id: "topic-sem-ordem",
      subjectId: "subject-1",
      name: "Orações sem ordem própria"
    });

    const { leaf } = await openLeifView(dataStore);
    const topicsTabButton =
      leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='topics']");

    if (!topicsTabButton) {
      throw new Error("Topics tab button was not rendered.");
    }

    topicsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const headerTexts = Array.from(
      leaf.containerEl.querySelectorAll("table.leif-table thead th")
    ).map((header) => header.textContent?.trim() ?? "");

    expect(headerTexts).toEqual(["Assunto", "Progresso", "Caderno", "Ações"]);
    expect(
      leaf.containerEl.querySelector("td.leif-topic-title-cell button[aria-label='Subir']")
    ).toBeNull();
    expect(
      leaf.containerEl.querySelector("td.leif-topic-title-cell button[aria-label='Descer']")
    ).toBeNull();

    const newTopicButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button[aria-label='Novo assunto']"
    );

    if (!newTopicButton) {
      throw new Error("New topic button was not rendered.");
    }

    newTopicButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = leaf.containerEl.querySelector<HTMLFormElement>("form.leif-card");
    expect(document.body.querySelector(".modal")).toBeNull();
    expect(form?.textContent).toContain("Novo assunto");
    expect(form?.textContent).not.toContain("Ordem");
    expect(form?.querySelector<HTMLInputElement>("input[placeholder='Ordem']")).toBeNull();
  });
});
