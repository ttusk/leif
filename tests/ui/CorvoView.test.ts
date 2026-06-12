// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import { UpdateContestWallUseCase } from "@/application/use-cases/UpdateContestWallUseCase";
import { createDefaultCorvoPluginData, type CorvoPluginData } from "@/domain/types/CorvoPluginData";
import { App, Plugin } from "../mocks/obsidian";
import { CORVO_VIEW_TYPE, registerCorvoView } from "@/ui/view/registerCorvoView";

class InMemoryPluginDataStore implements PluginDataStore {
  constructor(private data: CorvoPluginData = createDefaultCorvoPluginData()) {}

  async load(): Promise<CorvoPluginData> {
    return this.data;
  }

  async save(data: CorvoPluginData): Promise<void> {
    this.data = data;
  }
}

async function seedUiData(dataStore: PluginDataStore): Promise<void> {
  const createContest = new CreateContestUseCase(dataStore);
  const createSubject = new CreateSubjectUseCase(dataStore);
  const createStudyItem = new CreateStudyItemUseCase(dataStore);
  const updateContestWall = new UpdateContestWallUseCase(dataStore);
  const registerStudySession = new RegisterStudySessionUseCase(dataStore);
  const setActiveContest = new SetActiveContestUseCase(dataStore);

  await createContest.execute({ id: "contest-1", name: "TRT" });
  await createContest.execute({ id: "contest-2", name: "SEFAZ" });
  await createSubject.execute({
    id: "subject-1",
    contestId: "contest-1",
    name: "Portuguese",
    plannedStudyMinutes: 60
  });
  await createSubject.execute({
    id: "subject-2",
    contestId: "contest-1",
    name: "Constitutional Law",
    plannedStudyMinutes: 45
  });
  await createStudyItem.execute({
    id: "item-1",
    subjectId: "subject-1",
    title: "Sintaxe"
  });
  await updateContestWall.execute({
    contestId: "contest-1",
    wall: {
      noticeLinks: [{ id: "notice-1", label: "Edital", url: "https://example.com/edital" }],
      examLinks: [],
      subjectSnapshots: [],
      notes: "Foco em portugues."
    }
  });
  await registerStudySession.execute({
    id: "session-1",
    contestId: "contest-1",
    subjectId: "subject-1",
    studyItemId: "item-1",
    type: "pdf",
    studiedAt: "2026-06-11T20:00:00.000Z",
    pagesOrCount: 20,
    completed: true
  });
  await setActiveContest.execute({ contestId: "contest-1" });
}

async function openCorvoView(dataStore: PluginDataStore): Promise<{ plugin: Plugin; app: App; leaf: App["workspace"]["leaves"][number]; view: NonNullable<App["workspace"]["leaves"][number]["view"]> }> {
  const app = new App();
  const plugin = new Plugin(app);
  registerCorvoView(plugin as never, dataStore);

  const openCommand = plugin.commands.find((command) => command.id === "corvo-open-view");

  if (!openCommand) {
    throw new Error("Open view command was not registered.");
  }

  await openCommand.callback();

  const leaf = app.workspace.getLeavesOfType(CORVO_VIEW_TYPE)[0];

  if (!leaf?.view) {
    throw new Error("Corvo view was not opened.");
  }

  return { plugin, app, leaf, view: leaf.view };
}

describe("CorvoView", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("opens the Corvo view and renders all required tabs for an empty state", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const { plugin, leaf } = await openCorvoView(dataStore);

    expect(plugin.ribbonIcons).toHaveLength(1);
    expect(plugin.ribbonIcons[0]?.title).toBe("Abrir Corvo");
    expect(plugin.commands.map((command) => command.id)).toContain("corvo-open-view");
    expect(plugin.commands.find((command) => command.id === "corvo-open-view")?.name).toBe(
      "Abrir painel do Corvo"
    );
    expect(leaf.containerEl.textContent).toContain("Dashboard");
    expect(leaf.containerEl.textContent).toContain("Concursos");
    expect(leaf.containerEl.textContent).toContain("Ciclo e Matérias");
    expect(leaf.containerEl.textContent).toContain("Itens e PDFs");
    expect(leaf.containerEl.textContent).toContain("Assuntos e Questões");
    expect(leaf.containerEl.textContent).toContain("Sessões");
    expect(leaf.containerEl.textContent).toContain("Mural");
    expect(leaf.containerEl.textContent).toContain("Nenhum concurso ativo");
  });

  it("renders dashboard data from the active contest", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openCorvoView(dataStore);

    expect(leaf.containerEl.textContent).toContain("TRT");
    expect(leaf.containerEl.textContent).toContain("Portuguese");
    expect(leaf.containerEl.textContent).toContain("Constitutional Law");
    expect(leaf.containerEl.textContent).toContain("20");
    expect(leaf.containerEl.textContent).toContain("Planejamento e acompanhamento dos estudos.");
    expect(leaf.containerEl.textContent).toContain("Finalizar ciclo atual");
  });

  it("switches the active contest from the contests tab and rerenders the dashboard", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openCorvoView(dataStore);
    const contestsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='contests']");

    if (!contestsTabButton) {
      throw new Error("Contests tab button was not rendered.");
    }

    contestsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const activateButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-contest-id='contest-2']");

    if (!activateButton) {
      throw new Error("Activate contest button was not rendered.");
    }

    activateButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const dashboardTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='dashboard']");

    if (!dashboardTabButton) {
      throw new Error("Dashboard tab button was not rendered.");
    }

    dashboardTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(leaf.containerEl.textContent).toContain("SEFAZ");
  });

  it("formats session history dates with day, month and year", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const { leaf } = await openCorvoView(dataStore);
    const sessionsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(leaf.containerEl.textContent).toContain("11/06/2026");
    expect(leaf.containerEl.textContent).not.toMatch(/\b\d{2}:\d{2}\b/);
    expect(leaf.containerEl.textContent).toContain("PDF");
  });

  it("deletes a session from recent history", async () => {
    const dataStore = new InMemoryPluginDataStore();
    await seedUiData(dataStore);

    const originalConfirm = window.confirm;
    window.confirm = () => true;

    const { leaf } = await openCorvoView(dataStore);
    const sessionsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const deleteButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-session-delete-id='session-1']");

    if (!deleteButton) {
      throw new Error("Delete session button was not rendered.");
    }

    deleteButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    window.confirm = originalConfirm;

    expect(leaf.containerEl.textContent).not.toContain("11/06/2026");
    expect(leaf.containerEl.querySelector("[data-session-delete-id='session-1']")).toBeNull();
  });
});
