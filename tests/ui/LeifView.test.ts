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
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import { UpdateContestWallUseCase } from "@/application/use-cases/UpdateContestWallUseCase";
import { UpdateStudyItemUseCase } from "@/application/use-cases/UpdateStudyItemUseCase";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { App, getRecordedNotices, Plugin, resetRecordedNotices } from "../mocks/obsidian";
import { LEIF_VIEW_TYPE, registerLeifView } from "@/ui/view/registerLeifView";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { seedMinimalContest } from "@/infrastructure/persistence/Seeder";

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
  const setActiveContest = new SetActiveContestUseCase(dataStore, factory);

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

async function openLeifView(dataStore: PluginDataStore): Promise<{ plugin: Plugin; app: App; leaf: App["workspace"]["leaves"][number]; view: NonNullable<App["workspace"]["leaves"][number]["view"]> }> {
  const app = new App();
  const plugin = new Plugin(app);
  registerLeifView(plugin as never, dataStore);

  const openCommand = plugin.commands.find((command) => command.id === "leif-open-view");

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
  });

  it("opens the Leif view and renders all required tabs for an empty state", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const { plugin, leaf } = await openLeifView(dataStore);

    expect(plugin.ribbonIcons).toHaveLength(1);
    expect(plugin.ribbonIcons[0]?.title).toBe("Abrir Leif");
    expect(plugin.commands.map((command) => command.id)).toContain("leif-open-view");
    expect(plugin.commands.find((command) => command.id === "leif-open-view")?.name).toBe(
      "Abrir painel do Leif"
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
    const factory = await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);

    expect(leaf.containerEl.textContent).toContain("TRT");
    expect(leaf.containerEl.textContent).toContain("Portuguese");
    expect(leaf.containerEl.textContent).toContain("Constitutional Law");
    expect(leaf.containerEl.textContent).toContain("20");
    expect(leaf.containerEl.textContent).toContain("Visão geral do concurso ativo.");
  });

  it("switches the active contest from the contests tab and rerenders the dashboard", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
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

  it("uses larger text areas when editing contest name and notes", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const contestsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='contests']");

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

    const editingRow = leaf.containerEl.querySelector<HTMLTableRowElement>("tr.leif-editing-row");
    const textareas = editingRow?.querySelectorAll<HTMLTextAreaElement>("textarea.leif-textarea");

    expect(textareas).toHaveLength(2);
    expect(textareas?.[0]?.placeholder).toBe("Nome");
    expect(textareas?.[1]?.placeholder).toBe("Notas");
    expect(textareas?.[0]?.rows).toBe(1);
    expect(textareas?.[1]?.rows).toBe(2);
    expect(textareas?.[0]?.classList.contains("leif-textarea-inline")).toBe(true);
    expect(textareas?.[1]?.classList.contains("leif-textarea-notes")).toBe(true);
    expect(editingRow?.querySelectorAll("td")[3]?.textContent).toMatch(/^(Ativo|Inativo)$/);
  });

  it("formats session history dates with day, month and year", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
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

  it("shows cycle advance button in sessions tab", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(leaf.containerEl.textContent).toContain("Finalizar ciclo atual");
  });

  it("shows the recommended subject name in the cycle-advance notice", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const finishButton = Array.from(leaf.containerEl.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Finalizar ciclo atual")
    ) as HTMLButtonElement | undefined;

    if (!finishButton) {
      throw new Error("Finalizar ciclo atual button was not rendered.");
    }

    finishButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const notices = getRecordedNotices();
    const advanceNotice = notices.find((notice) => notice.startsWith("Ciclo finalizado!"));

    expect(advanceNotice).toBeDefined();
    expect(advanceNotice).not.toContain("—");
    expect(advanceNotice).toContain("Portuguese");
  });

  it("deletes a session from recent history", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
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

    const confirmButton = document.body.querySelector<HTMLButtonElement>('[data-leif-confirm="submit"]');
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
    const sessionsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const newButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button.leif-icon-button[title='Nova sessão']"
    );

    if (!newButton) {
      throw new Error("New session button was not rendered.");
    }

    newButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = document.body.querySelector<HTMLFormElement>("form.leif-form");

    if (!form) {
      throw new Error("Session form was not rendered.");
    }

    const selects = form.querySelectorAll<HTMLSelectElement>("select.leif-select");
    const inputs = form.querySelectorAll<HTMLInputElement>("input.leif-input");

    const subjectSelect = selects[0];
    const typeSelect = selects[1];
    const topicSelect = selects[3];
    const countInput = inputs[0];
    const correctInput = inputs[1];
    const dateInput = inputs[2];

    if (!subjectSelect || !typeSelect || !topicSelect || !countInput || !correctInput || !dateInput) {
      throw new Error("Form controls were not found.");
    }

    subjectSelect.value = "subject-1";
    subjectSelect.dispatchEvent(new Event("change"));
    topicSelect.value = "topic-1";
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
    const sessionsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const newButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button.leif-icon-button[title='Nova sessão']"
    );

    if (!newButton) {
      throw new Error("New session button was not rendered.");
    }

    newButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = document.body.querySelector<HTMLFormElement>("form.leif-form");

    if (!form) {
      throw new Error("Session form was not rendered.");
    }

    const selects = form.querySelectorAll<HTMLSelectElement>("select.leif-select");
    const inputs = form.querySelectorAll<HTMLInputElement>("input.leif-input");

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
    const sessionsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const newButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button.leif-icon-button[title='Nova sessão']"
    );

    if (!newButton) {
      throw new Error("New session button was not rendered.");
    }

    newButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = document.body.querySelector<HTMLFormElement>("form.leif-form");

    if (!form) {
      throw new Error("Session form was not rendered.");
    }

    const selects = form.querySelectorAll<HTMLSelectElement>("select.leif-select");
    const inputs = form.querySelectorAll<HTMLInputElement>("input.leif-input");

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

  it("shows the Acertos column for questions sessions and hides it for other types", async () => {
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
    const sessionsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

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

    expect(questionsCells.length).toBe(pdfCells.length);
    expect(questionsCells[questionsCells.length - 2].textContent).toContain("15");

    const headerCells = leaf.containerEl.querySelectorAll("table.leif-table thead th");
    const headerTexts = Array.from(headerCells).map((cell) => cell.textContent?.trim() ?? "");
    expect(headerTexts).toContain("Acertos");
  });

  it("uses user-facing labels for the session form type select", async () => {
    const dataStore = new InMemoryPluginDataStore();
    const factory = await seedUiData(dataStore);

    const { leaf } = await openLeifView(dataStore);
    const sessionsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

    if (!sessionsTabButton) {
      throw new Error("Sessions tab button was not rendered.");
    }

    sessionsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const newButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button.leif-icon-button[title='Nova sessão']"
    );

    if (!newButton) {
      throw new Error("New session button was not rendered.");
    }

    newButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = document.body.querySelector<HTMLFormElement>("form.leif-form");

    if (!form) {
      throw new Error("Session form was not rendered.");
    }

    const selects = form.querySelectorAll<HTMLSelectElement>("select.leif-select");
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

    const completedRow = leaf.containerEl.querySelector<HTMLTableRowElement>(
      `tr[data-item-id='${itemA.id}']`
    );
    const partialRow = leaf.containerEl.querySelector<HTMLTableRowElement>(
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
    expect(completedProgressBar).not.toBeNull();
    expect(partialProgressBar).not.toBeNull();
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

    const itemRow = leaf.containerEl.querySelector<HTMLTableRowElement>(
      `tr[data-item-id='${item.id}']`
    );
    const editButton = itemRow?.querySelector<HTMLButtonElement>("button[title='Editar']");

    if (!editButton) {
      throw new Error("Edit button was not rendered.");
    }

    editButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const editingRow = leaf.containerEl.querySelector<HTMLTableRowElement>("tr.leif-editing-row");
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
    expect(updatedData.studyItems.find((candidate) => candidate.id === item.id)?.title).toBe("Concordância");
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
    const sessionsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='sessions']");

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
  });

  it("uses user-facing labels for the item resource type select and detail row", async () => {
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

    const detailRow = leaf.containerEl.querySelector(".leif-detail-row");
    expect(detailRow?.textContent).toContain("PDF: Apostila A");

    const form = detailRow?.querySelector("form.leif-detail-form");
    const typeSelect = form?.querySelector("select.leif-select");
    const labels = Array.from(typeSelect?.querySelectorAll("option") ?? []).map(
      (option) => option.textContent?.trim() ?? ""
    );

    expect(labels).toEqual(["PDF", "Vídeo", "Link"]);
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
    const topicsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='topics']");

    if (!topicsTabButton) {
      throw new Error("Topics tab button was not rendered.");
    }

    topicsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const topicRow = leaf.containerEl.querySelector<HTMLTableRowElement>(
      "tr[data-topic-id='topic-caderno']"
    );
    const expandButton = topicRow?.querySelector<HTMLButtonElement>("button[title='Expandir']");

    if (!expandButton) {
      throw new Error("Topic expand button was not rendered.");
    }

    expandButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const notebookForm = leaf.containerEl.querySelector<HTMLFormElement>("form[data-topic-notebook-form='topic-caderno']");
    const genericResourceForm = leaf.containerEl.querySelector<HTMLFormElement>(
      ".leif-detail-row form.leif-detail-form:not([data-topic-notebook-form])"
    );
    const notebookName = notebookForm?.querySelector<HTMLInputElement>("input[placeholder='Caderno']");
    const notebookUrl = notebookForm?.querySelector<HTMLInputElement>("input[placeholder='URL']");
    const saveButton = notebookForm?.querySelector<HTMLButtonElement>("button[title='Salvar']");

    if (!notebookName || !notebookUrl || !saveButton) {
      throw new Error("Notebook assignment controls were not rendered.");
    }
    expect(genericResourceForm).toBeNull();

    notebookName.value = "Tec Concursos - Coordenadas";
    notebookUrl.value = "https://tec.example.com/coordenadas";
    saveButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const data = await dataStore.load();
    expect(data.topics.find((topic) => topic.id === "topic-caderno")?.questionNotebook).toMatchObject({
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
    expect(openSpy).toHaveBeenCalledWith("https://tec.example.com/coordenadas", "_blank", "noopener");
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
    const topicsTabButton = leaf.containerEl.querySelector<HTMLButtonElement>("[data-tab='topics']");

    if (!topicsTabButton) {
      throw new Error("Topics tab button was not rendered.");
    }

    topicsTabButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const headerTexts = Array.from(leaf.containerEl.querySelectorAll("table.leif-table thead th"))
      .map((header) => header.textContent?.trim() ?? "");

    expect(headerTexts).toEqual(["Assunto", "Caderno", "Resolv.", "Acert.", "Ações"]);

    const newTopicButton = leaf.containerEl.querySelector<HTMLButtonElement>(
      "button.leif-icon-button[title='Novo assunto']"
    );

    if (!newTopicButton) {
      throw new Error("New topic button was not rendered.");
    }

    newTopicButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const modal = document.body.querySelector(".leif-modal-card");
    expect(modal?.textContent).toContain("Novo assunto");
    expect(modal?.textContent).not.toContain("Ordem");
    expect(modal?.querySelector<HTMLInputElement>("input[placeholder='Ordem']")).toBeNull();
  });
});
