const notices: string[] = [];
const registeredIcons = new Map<string, string>();

type ViewCreator = (leaf: WorkspaceLeaf) => ItemView;

export class Notice {
  constructor(message: string) {
    notices.push(message);
  }
}

export class Plugin {
  app: App;
  commands: Array<{ id: string; name: string; callback: () => Promise<void> | void }> = [];
  ribbonIcons: Array<{ icon: string; title: string; callback: (evt: MouseEvent) => unknown }> = [];
  settingTabs: PluginSettingTab[] = [];
  private storedData: unknown = null;

  constructor(app = new App()) {
    this.app = app;
  }

  addCommand(command: { id: string; name: string; callback: () => Promise<void> | void }): void {
    this.commands.push(command);
  }

  addRibbonIcon(icon: string, title: string, callback: (evt: MouseEvent) => unknown): HTMLElement {
    this.ribbonIcons.push({ icon, title, callback });
    return document.createElement("div");
  }

  addSettingTab(settingTab: PluginSettingTab): void {
    this.settingTabs.push(settingTab);
  }

  registerView(type: string, viewCreator: ViewCreator): void {
    this.app.workspace.registerView(type, viewCreator);
  }

  async loadData(): Promise<unknown> {
    return this.storedData;
  }

  async saveData(data: unknown): Promise<void> {
    this.storedData = data;
  }
}

export class App {
  workspace = new Workspace();
}

export class Workspace {
  private readonly viewCreators = new Map<string, ViewCreator>();
  readonly leaves: WorkspaceLeaf[] = [];

  registerView(type: string, viewCreator: ViewCreator): void {
    this.viewCreators.set(type, viewCreator);
  }

  getLeavesOfType(type: string): WorkspaceLeaf[] {
    return this.leaves.filter((leaf) => leaf.view?.getViewType() === type);
  }

  getLeaf(): WorkspaceLeaf {
    const leaf = new WorkspaceLeaf(this);
    this.leaves.push(leaf);
    return leaf;
  }

  getRightLeaf(_split: boolean): WorkspaceLeaf {
    return this.getLeaf();
  }

  async revealLeaf(_leaf: WorkspaceLeaf): Promise<void> {
    // Test stub.
  }

  getViewCreator(type: string): ViewCreator | undefined {
    return this.viewCreators.get(type);
  }
}

export class WorkspaceLeaf {
  view: ItemView | null = null;
  readonly containerEl: HTMLDivElement;

  constructor(private readonly workspace: Workspace) {
    this.containerEl = document.createElement("div");
  }

  async setViewState(state: { type: string; active?: boolean }): Promise<void> {
    const viewCreator = this.workspace.getViewCreator(state.type);

    if (!viewCreator) {
      throw new Error(`No view creator registered for "${state.type}".`);
    }

    this.view = viewCreator(this);
    await this.view.onOpen();
  }
}

export abstract class ItemView {
  readonly contentEl: HTMLDivElement;

  constructor(public readonly leaf: WorkspaceLeaf) {
    this.contentEl = document.createElement("div");
    this.leaf.containerEl.innerHTML = "";
    this.leaf.containerEl.appendChild(this.contentEl);
  }

  abstract getViewType(): string;

  abstract getDisplayText(): string;

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    // Test stub.
  }

  async onClose(): Promise<void> {
    // Test stub.
  }

  addAction(_icon: string, _title: string, _callback: (evt: MouseEvent) => unknown): HTMLElement {
    return document.createElement("button");
  }
}

export abstract class PluginSettingTab {
  readonly containerEl: HTMLDivElement;

  constructor(
    public readonly app: App,
    public readonly plugin: Plugin
  ) {
    this.containerEl = document.createElement("div");
  }

  abstract display(): void;
}

export function addIcon(name: string, svgContent: string): void {
  registeredIcons.set(name, svgContent);
}

export function getRegisteredIcon(name: string): string | undefined {
  return registeredIcons.get(name);
}

export function getRecordedNotices(): string[] {
  return notices;
}

export function resetRecordedNotices(): void {
  notices.length = 0;
  registeredIcons.clear();
}
