import { ItemView, type WorkspaceLeaf } from "obsidian";

import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { ContestsTab } from "@/ui/view/components/ContestsTab";
import { CycleTab } from "@/ui/view/components/CycleTab";
import { DashboardTab } from "@/ui/view/components/DashboardTab";
import { ItemsTab } from "@/ui/view/components/ItemsTab";
import { SessionsTab } from "@/ui/view/components/SessionsTab";
import { TopicsTab } from "@/ui/view/components/TopicsTab";
import { WallTab } from "@/ui/view/components/WallTab";
import { LEIF_ICON, LEIF_VIEW_TYPE } from "@/ui/view/registerLeifView";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { SubjectPicker } from "@/ui/view/shared/SubjectPicker";
import { PLAN_TABS, PRIMARY_TABS, type LeifPrimaryTabId, type LeifTabId } from "@/ui/constants";

/**
 * Main Leif view with incremental rendering optimization.
 * Builds the shell structure once and only updates the active tab content on changes.
 */
export class LeifView extends ItemView {
  private activeTab: LeifTabId = "dashboard";
  private activePlanTab: Extract<LeifTabId, "cycle" | "topics" | "items"> = "cycle";
  private selectedSubjectId: string | null = null;

  private shell?: HTMLElement;
  private headerActions?: HTMLElement;
  private diagnosticsContainer?: HTMLElement;
  private workspace?: HTMLElement;
  private primaryTabBar?: HTMLElement;
  private planTabBar?: HTMLElement;
  private activeTabContainer?: HTMLElement;
  private resizeObserver?: ResizeObserver;
  private primaryTabButtons: Map<LeifPrimaryTabId, HTMLButtonElement> = new Map();
  private planTabButtons: Map<Extract<LeifTabId, "cycle" | "topics" | "items">, HTMLButtonElement> =
    new Map();

  private readonly dashboardTab: DashboardTab;
  private readonly contestsTab: ContestsTab;
  private readonly cycleTab: CycleTab;
  private readonly itemsTab: ItemsTab;
  private readonly topicsTab: TopicsTab;
  private readonly sessionsTab: SessionsTab;
  private readonly wallTab: WallTab;
  private readonly setActiveContestUseCase: SetActiveContestUseCase;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly dataStore: PluginDataStore
  ) {
    super(leaf);
    this.dashboardTab = new DashboardTab(dataStore, (tabId, registration) => {
      if (tabId === "sessions" && registration) {
        this.sessionsTab.startRecommendedStudy(registration);
      }
      return this.selectTab(tabId);
    });
    this.contestsTab = new ContestsTab(dataStore, () => this.refresh());
    this.cycleTab = new CycleTab(dataStore, () => this.refresh());
    this.itemsTab = new ItemsTab(dataStore, () => this.refresh());
    this.topicsTab = new TopicsTab(dataStore, () => this.refresh());
    this.sessionsTab = new SessionsTab(dataStore, () => this.refresh());
    this.wallTab = new WallTab(dataStore, () => this.refresh());
    this.setActiveContestUseCase = new SetActiveContestUseCase(
      dataStore,
      new EntityRepositoryFactory(dataStore)
    );
  }

  getViewType(): string {
    return LEIF_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Leif";
  }

  override getIcon(): string {
    return LEIF_ICON;
  }

  override async onOpen(): Promise<void> {
    await this.render();
  }

  override async onClose(): Promise<void> {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  /**
   * Full render - builds the shell structure once, then updates dynamic content.
   */
  async render(): Promise<void> {
    const data = await this.dataStore.load();
    this.ensureSelectedSubject(data);

    if (!this.shell) {
      this.buildShell();
    }

    await this.updateHeader(data);
    this.updateDiagnostics();
    await this.updateActiveTab(data);
  }

  /**
   * Refresh - updates only the active tab content without rebuilding the shell.
   */
  private async refresh(): Promise<void> {
    const data = await this.dataStore.load();
    this.ensureSelectedSubject(data);
    await this.updateHeader(data);
    this.updateDiagnostics();
    await this.updateActiveTab(data);
  }

  /**
   * Builds the shell structure once.
   */
  private buildShell(): void {
    this.contentEl.innerHTML = "";
    this.contentEl.classList.add("leif-view");

    this.shell = DomHelpers.createElement("div", "leif-shell");

    const header = DomHelpers.createElement("header", "leif-header");
    this.headerActions = DomHelpers.createElement("div", "leif-header-actions");
    header.appendChild(this.headerActions);

    this.diagnosticsContainer = DomHelpers.createElement("section", "leif-diagnostics");
    this.diagnosticsContainer.setAttribute("role", "alert");
    this.diagnosticsContainer.hidden = true;

    this.workspace = DomHelpers.createElement("div", "leif-workspace");
    const navigation = DomHelpers.createElement("nav", "leif-navigation");
    navigation.setAttribute("aria-label", "Navegação do Leif");

    this.primaryTabBar = DomHelpers.createElement("div", "leif-tab-bar leif-primary-navigation");
    this.primaryTabBar.setAttribute("role", "tablist");
    this.primaryTabBar.setAttribute("aria-label", "Seções do Leif");
    PRIMARY_TABS.forEach((tab, index) => {
      const button = DomHelpers.createElement("button", "leif-tab-button");
      button.type = "button";
      button.textContent = tab.label;
      button.dataset.tab = tab.id;
      button.addEventListener("click", () => {
        void this.selectPrimaryTab(tab.id);
      });
      button.setAttribute("role", "tab");
      button.id = `leif-tab-${tab.id}`;
      button.tabIndex = tab.id === "dashboard" ? 0 : -1;
      button.setAttribute("aria-selected", String(tab.id === "dashboard"));
      button.setAttribute("aria-controls", "leif-tabpanel");
      button.addEventListener("keydown", (event: KeyboardEvent) => {
        this.handlePrimaryTabKeyDown(event, index);
      });
      this.primaryTabButtons.set(tab.id, button);
      this.primaryTabBar!.appendChild(button);
    });

    this.planTabBar = DomHelpers.createElement("div", "leif-plan-navigation");
    this.planTabBar.setAttribute("role", "tablist");
    this.planTabBar.setAttribute("aria-label", "Seções do plano");
    PLAN_TABS.forEach((tab, index) => {
      const button = DomHelpers.createElement("button", "leif-tab-button");
      button.type = "button";
      button.textContent = tab.label;
      button.dataset.tab = tab.id;
      button.setAttribute("role", "tab");
      button.id = `leif-tab-${tab.id}`;
      button.setAttribute("aria-controls", "leif-tabpanel");
      button.addEventListener("click", () => {
        void this.selectTab(tab.id);
      });
      button.addEventListener("keydown", (event: KeyboardEvent) => {
        this.handlePlanTabKeyDown(event, index);
      });
      this.planTabButtons.set(tab.id, button);
      this.planTabBar!.appendChild(button);
    });
    this.planTabBar.hidden = true;
    navigation.append(this.primaryTabBar, this.planTabBar);

    this.activeTabContainer = DomHelpers.createElement("section", "leif-body");
    this.activeTabContainer.id = "leif-tabpanel";
    this.activeTabContainer.setAttribute("role", "tabpanel");
    this.activeTabContainer.setAttribute("tabindex", "0");
    this.activeTabContainer.setAttribute("aria-labelledby", `leif-tab-${this.activeTab}`);

    this.workspace.append(navigation, this.activeTabContainer);
    this.shell.append(header, this.diagnosticsContainer, this.workspace);
    this.contentEl.appendChild(this.shell);
    this.observePaneWidth();
  }

  /**
   * Obsidian views can be resized independently of the app window. A
   * ResizeObserver keeps the layout tied to the leaf width, including split
   * panes where viewport media queries do not apply.
   */
  private observePaneWidth(): void {
    if (typeof ResizeObserver === "undefined") return;

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) {
        this.updateResponsiveClasses(width);
      }
    });
    this.resizeObserver.observe(this.contentEl);
  }

  private updateResponsiveClasses(width: number): void {
    this.contentEl.classList.toggle("is-narrow", width <= 760);
    this.contentEl.classList.toggle("is-compact", width <= 520);
  }

  /**
   * Updates the header actions with current data.
   */
  private async updateHeader(data: LeifPluginData): Promise<void> {
    if (!this.headerActions) return;

    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);
    this.headerActions.innerHTML = "";

    const switcher = DomHelpers.createElement("div", "leif-contest-switcher");
    const selector = DomHelpers.createElement("button", "leif-contest-selector");
    selector.type = "button";
    selector.textContent = activeContest?.name ?? "Escolha um concurso";
    selector.setAttribute("aria-haspopup", "menu");
    selector.setAttribute("aria-expanded", "false");

    const menu = DomHelpers.createElement("div", "leif-contest-menu");
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Concursos");
    menu.hidden = true;

    data.contests.forEach((contest) => {
      const option = DomHelpers.createElement("button", "leif-contest-option");
      option.type = "button";
      option.textContent = contest.name;
      option.setAttribute("role", "menuitemradio");
      option.setAttribute("aria-checked", String(contest.id === data.activeContestId));
      option.addEventListener("click", () => {
        void this.activateContest(contest.id);
      });
      menu.appendChild(option);
    });

    const manage = DomHelpers.createElement("button", "leif-contest-manage");
    manage.type = "button";
    manage.id = "leif-contest-management";
    manage.dataset.tab = "contests";
    manage.textContent = "Gerenciar concursos";
    manage.setAttribute("role", "menuitem");
    manage.addEventListener("click", () => {
      menu.hidden = true;
      void this.selectTab("contests");
    });
    menu.appendChild(manage);

    selector.addEventListener("click", () => {
      menu.hidden = !menu.hidden;
      selector.setAttribute("aria-expanded", String(!menu.hidden));
    });
    switcher.append(selector, menu);
    this.headerActions.appendChild(switcher);
  }

  private updateDiagnostics(): void {
    if (!this.diagnosticsContainer) return;
    const diagnostics = this.dataStore.diagnostics?.() ?? [];
    this.diagnosticsContainer.replaceChildren();
    this.diagnosticsContainer.hidden = diagnostics.length === 0;
    if (diagnostics.length === 0) return;

    const title = DomHelpers.createElement("strong");
    title.textContent = "Leif protegeu seus dados";
    const explanation = DomHelpers.createParagraph(
      "Há arquivos Markdown que precisam de revisão. Leif bloqueou escritas neles."
    );
    const list = DomHelpers.createElement("ul", "leif-diagnostics-list");
    diagnostics.forEach((diagnostic) => {
      const item = DomHelpers.createElement("li");
      const path = DomHelpers.createElement("code");
      const message = DomHelpers.createElement("span");
      path.textContent = diagnostic.path;
      message.textContent = ` — ${diagnostic.message}`;
      item.append(path, message);
      list.appendChild(item);
    });
    this.diagnosticsContainer.append(title, explanation, list);
  }

  /**
   * Updates the active tab button styles and renders the active tab content.
   */
  private async updateActiveTab(data: LeifPluginData): Promise<void> {
    if (!this.activeTabContainer) return;

    this.updateTabButtonStyles();
    this.activeTabContainer.innerHTML = "";
    await this.renderActiveTab(this.activeTabContainer, data);
  }

  /**
   * Selects a tab, updating aria state and re-rendering.
   */
  private async selectTab(tabId: LeifTabId): Promise<void> {
    this.activeTab = tabId;
    if (tabId === "cycle" || tabId === "topics" || tabId === "items") {
      this.activePlanTab = tabId;
    }
    this.updateTabButtonStyles();
    await this.refresh();
  }

  /**
   * Selects a primary section. Plano remembers its last active subsection.
   */
  private async selectPrimaryTab(tabId: LeifPrimaryTabId): Promise<void> {
    await this.selectTab(tabId === "plan" ? this.activePlanTab : tabId);
  }

  private handlePrimaryTabKeyDown(event: KeyboardEvent, index: number): void {
    const tabIds = PRIMARY_TABS.map((tab) => tab.id);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = tabIds[(index + 1) % tabIds.length];
      void this.selectPrimaryTab(next);
      this.primaryTabButtons.get(next)?.focus();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = tabIds[(index - 1 + tabIds.length) % tabIds.length];
      void this.selectPrimaryTab(prev);
      this.primaryTabButtons.get(prev)?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const target = event.key === "Home" ? tabIds[0] : tabIds[tabIds.length - 1];
      void this.selectPrimaryTab(target);
      this.primaryTabButtons.get(target)?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void this.selectPrimaryTab(tabIds[index]);
    }
  }

  private handlePlanTabKeyDown(event: KeyboardEvent, index: number): void {
    const tabIds = PLAN_TABS.map((tab) => tab.id);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = tabIds[(index + 1) % tabIds.length];
      void this.selectTab(next);
      this.planTabButtons.get(next)?.focus();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const previous = tabIds[(index - 1 + tabIds.length) % tabIds.length];
      void this.selectTab(previous);
      this.planTabButtons.get(previous)?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const target = event.key === "Home" ? tabIds[0] : tabIds[tabIds.length - 1];
      void this.selectTab(target);
      this.planTabButtons.get(target)?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void this.selectTab(tabIds[index]);
    }
  }

  /**
   * Updates the active class on tab buttons.
   */
  private updateTabButtonStyles(): void {
    const primaryTabId = this.getActivePrimaryTab();
    this.primaryTabButtons.forEach((button, tabId) => {
      const isActive = primaryTabId === tabId;
      button.className = isActive ? "leif-tab-button is-active" : "leif-tab-button";
      button.tabIndex = isActive ? 0 : -1;
      button.setAttribute("aria-selected", String(isActive));
    });
    this.planTabButtons.forEach((button, tabId) => {
      const isActive = this.activeTab === tabId;
      button.className = isActive ? "leif-tab-button is-active" : "leif-tab-button";
      button.tabIndex = isActive ? 0 : -1;
      button.setAttribute("aria-selected", String(isActive));
    });
    if (this.planTabBar) {
      this.planTabBar.hidden = primaryTabId !== "plan";
    }
    const labelledBy =
      this.activeTab === "contests" ? "leif-contest-management" : `leif-tab-${this.activeTab}`;
    this.activeTabContainer?.setAttribute("aria-labelledby", labelledBy);
  }

  private getActivePrimaryTab(): LeifPrimaryTabId | null {
    if (this.activeTab === "cycle" || this.activeTab === "topics" || this.activeTab === "items") {
      return "plan";
    }
    if (this.activeTab === "contests") return null;
    return this.activeTab;
  }

  private async activateContest(contestId: string): Promise<void> {
    try {
      await this.setActiveContestUseCase.execute({ contestId });
      this.activeTab = "dashboard";
      await this.refresh();
    } catch (error) {
      DomHelpers.notifyError(error, "Não foi possível escolher o concurso.");
    }
  }

  private async renderActiveTab(container: HTMLElement, data: LeifPluginData): Promise<void> {
    switch (this.activeTab) {
      case "dashboard":
        await this.dashboardTab.render(container, data);
        break;
      case "contests":
        await this.contestsTab.render(container, data);
        break;
      case "cycle":
        await this.cycleTab.render(container, data);
        break;
      case "items":
        await this.itemsTab.render(container, data);
        break;
      case "topics":
        await this.topicsTab.render(container, data);
        break;
      case "sessions":
        await this.sessionsTab.render(container, data);
        break;
      case "wall":
        await this.wallTab.render(container, data);
        break;
    }
  }

  private ensureSelectedSubject(data: LeifPluginData): void {
    const selectedSubject = SubjectPicker.getSelectedSubject(data, this.selectedSubjectId);
    this.selectedSubjectId = selectedSubject?.id ?? null;
  }
}
