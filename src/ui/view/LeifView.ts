import { ItemView, type WorkspaceLeaf } from "obsidian";

import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";
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
import { TABS, type LeifTabId } from "@/ui/constants";

/**
 * Main Leif view with incremental rendering optimization.
 * Builds the shell structure once and only updates the active tab content on changes.
 */
export class LeifView extends ItemView {
  private activeTab: LeifTabId = "dashboard";
  private selectedSubjectId: string | null = null;

  private shell?: HTMLElement;
  private headerActions?: HTMLElement;
  private tabBar?: HTMLElement;
  private activeTabContainer?: HTMLElement;
  private tabButtons: Map<LeifTabId, HTMLElement> = new Map();

  private readonly dashboardTab: DashboardTab;
  private readonly contestsTab: ContestsTab;
  private readonly cycleTab: CycleTab;
  private readonly itemsTab: ItemsTab;
  private readonly topicsTab: TopicsTab;
  private readonly sessionsTab: SessionsTab;
  private readonly wallTab: WallTab;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly dataStore: PluginDataStore
  ) {
    super(leaf);
    this.dashboardTab = new DashboardTab(dataStore, () => this.refresh());
    this.contestsTab = new ContestsTab(dataStore, () => this.refresh());
    this.cycleTab = new CycleTab(dataStore, () => this.refresh());
    this.itemsTab = new ItemsTab(dataStore, () => this.refresh());
    this.topicsTab = new TopicsTab(dataStore, () => this.refresh());
    this.sessionsTab = new SessionsTab(dataStore, () => this.refresh());
    this.wallTab = new WallTab(dataStore, () => this.refresh());
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
    await this.updateActiveTab(data);
  }

  /**
   * Refresh - updates only the active tab content without rebuilding the shell.
   */
  private async refresh(): Promise<void> {
    const data = await this.dataStore.load();
    this.ensureSelectedSubject(data);
    await this.updateHeader(data);
    await this.updateActiveTab(data);
  }

  /**
   * Builds the shell structure once.
   */
  private buildShell(): void {
    this.contentEl.innerHTML = "";
    this.contentEl.className = "leif-view";

    this.shell = DomHelpers.createElement("div", "leif-shell");

    const header = DomHelpers.createElement("header", "leif-header");
    const titleGroup = DomHelpers.createElement("div", "leif-title-group");
    titleGroup.append(
      DomHelpers.createHeading("Leif"),
      DomHelpers.createParagraph("Seu plano de estudos dentro do Obsidian.")
    );

    this.headerActions = DomHelpers.createElement("div", "leif-header-actions");
    header.append(titleGroup, this.headerActions);

    this.tabBar = DomHelpers.createElement("nav", "leif-tab-bar");
    this.tabBar.setAttribute("role", "tablist");
    this.tabBar.setAttribute("aria-label", "Seções do Leif");
    TABS.forEach((tab, index) => {
      const button = DomHelpers.createElement("div", "leif-tab-button");
      button.textContent = tab.label;
      button.dataset.tab = tab.id;
      button.addEventListener("click", async () => {
        await this.selectTab(tab.id);
      });
      button.setAttribute("role", "tab");
      button.id = `leif-tab-${tab.id}`;
      button.tabIndex = tab.id === this.activeTab ? 0 : -1;
      button.setAttribute("aria-selected", String(tab.id === this.activeTab));
      button.setAttribute("aria-controls", "leif-tabpanel");
      button.addEventListener("keydown", (event: KeyboardEvent) => {
        this.handleTabKeyDown(event, index);
      });
      this.tabButtons.set(tab.id, button);
      this.tabBar!.appendChild(button);
    });

    this.activeTabContainer = DomHelpers.createElement("section", "leif-body");
    this.activeTabContainer.id = "leif-tabpanel";
    this.activeTabContainer.setAttribute("role", "tabpanel");
    this.activeTabContainer.setAttribute("tabindex", "0");
    this.activeTabContainer.setAttribute("aria-labelledby", `leif-tab-${this.activeTab}`);

    this.shell.append(header, this.tabBar, this.activeTabContainer);
    this.contentEl.appendChild(this.shell);
  }

  /**
   * Updates the header actions with current data.
   */
  private async updateHeader(data: LeifPluginData): Promise<void> {
    if (!this.headerActions) return;

    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);
    this.headerActions.innerHTML = "";
    this.headerActions.appendChild(
      DomHelpers.createBadge(activeContest ? `Estudando: ${activeContest.name}` : "Sem concurso escolhido")
    );
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
    this.updateTabButtonStyles();
    await this.refresh();
  }

  /**
   * Moves focus between tabs with Arrow keys and activates on Enter/Space.
   */
  private handleTabKeyDown(event: KeyboardEvent, index: number): void {
    const tabIds = TABS.map((tab) => tab.id);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = tabIds[(index + 1) % tabIds.length];
      void this.selectTab(next);
      this.tabButtons.get(next)?.focus();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = tabIds[(index - 1 + tabIds.length) % tabIds.length];
      void this.selectTab(prev);
      this.tabButtons.get(prev)?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void this.selectTab(tabIds[index]);
    }
  }

  /**
   * Updates the active class on tab buttons.
   */
  private updateTabButtonStyles(): void {
    this.tabButtons.forEach((button, tabId) => {
      const isActive = this.activeTab === tabId;
      button.className = isActive ? "leif-tab-button is-active" : "leif-tab-button";
      button.tabIndex = isActive ? 0 : -1;
      button.setAttribute("aria-selected", String(isActive));
    });
    this.activeTabContainer?.setAttribute("aria-labelledby", `leif-tab-${this.activeTab}`);
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
