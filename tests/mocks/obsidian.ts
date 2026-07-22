const notices: string[] = [];
const registeredIcons = new Map<string, string>();
const openModals: Modal[] = [];

globalThis.createEl = ((tagName, options) => {
  const element = document.createElement(tagName);
  const className = typeof options === "string" ? options : options?.cls;

  if (className) {
    element.className = Array.isArray(className) ? className.join(" ") : className;
  }

  return element;
}) as typeof createEl;

type ViewCreator = (leaf: WorkspaceLeaf) => ItemView;

export class Notice {
  constructor(message: string) {
    notices.push(message);
  }
}

export class Plugin {
  app: App;
  manifest: { version: string };
  commands: Array<{ id: string; name: string; callback: () => Promise<void> | void }> = [];
  ribbonIcons: Array<{ icon: string; title: string; callback: (evt: MouseEvent) => unknown }> = [];
  settingTabs: PluginSettingTab[] = [];
  private storedData: unknown = null;

  constructor(app = new App(), manifest: { version?: string } = {}) {
    this.app = app;
    this.manifest = { version: manifest.version ?? "1.0.2" };
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
  vault = new Vault();
}

export class TAbstractFile {
  constructor(public path: string) {}
}

export class TFile extends TAbstractFile {}

export class Vault {
  private readonly files = new Map<string, { file: TFile; content: string }>();
  private readonly folders = new Map<string, TAbstractFile>();
  readonly adapter = {
    exists: async (path: string) => this.files.has(path) || this.folders.has(path),
    read: async (path: string) => this.files.get(path)?.content ?? "",
    write: async (path: string, content: string) => {
      const file = new TFile(path);
      this.files.set(path, { file, content });
    },
    mkdir: async (path: string) => {
      if (this.files.has(path) || this.folders.has(path)) throw new Error("Folder already exists.");
      this.folders.set(path, new TAbstractFile(path));
    },
    list: async (path: string) => ({
      files: [...this.files.keys()].filter((candidate) => isDirectChild(path, candidate)),
      folders: [...this.folders.keys()].filter((candidate) => isDirectChild(path, candidate))
    }),
    rename: async (source: string, destination: string) => {
      this.renamePath(source, destination);
    }
  };

  getFiles(): TFile[] {
    return [...this.files.values()]
      .map(({ file }) => file)
      .filter((file) => !isHiddenPath(file.path));
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    if (isHiddenPath(path)) return null;
    return this.files.get(path)?.file ?? this.folders.get(path) ?? null;
  }

  async create(path: string, content: string): Promise<TFile> {
    const file = new TFile(path);
    this.files.set(path, { file, content });
    return file;
  }

  async read(file: TFile): Promise<string> {
    return this.files.get(file.path)?.content ?? "";
  }

  async createFolder(path: string): Promise<void> {
    this.folders.set(path, new TAbstractFile(path));
  }

  async rename(file: TAbstractFile, newPath: string): Promise<void> {
    this.renamePath(file.path, newPath);
  }

  private renamePath(oldPath: string, newPath: string): void {
    const storedFile = this.files.get(oldPath);
    if (storedFile) {
      this.files.delete(oldPath);
      storedFile.file.path = newPath;
      this.files.set(newPath, storedFile);
      return;
    }

    const affectedFiles = [...this.files.entries()].filter(([path]) =>
      path.startsWith(`${oldPath}/`)
    );
    affectedFiles.forEach(([path, entry]) => {
      this.files.delete(path);
      entry.file.path = `${newPath}${path.slice(oldPath.length)}`;
      this.files.set(entry.file.path, entry);
    });
    const affectedFolders = [...this.folders.entries()].filter(
      ([path]) => path === oldPath || path.startsWith(`${oldPath}/`)
    );
    affectedFolders.forEach(([path, folder]) => {
      this.folders.delete(path);
      folder.path = `${newPath}${path.slice(oldPath.length)}`;
      this.folders.set(folder.path, folder);
    });
  }
}

function isHiddenPath(path: string): boolean {
  return path.split("/").some((segment) => segment.startsWith("."));
}

function isDirectChild(parent: string, candidate: string): boolean {
  return candidate.startsWith(`${parent}/`) && !candidate.slice(parent.length + 1).includes("/");
}

export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\//, "");
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

  setActiveLeaf(_leaf: WorkspaceLeaf, _params?: { focus?: boolean }): void {
    // Test stub.
  }

  getViewCreator(type: string): ViewCreator | undefined {
    return this.viewCreators.get(type);
  }

  onLayoutReady(callback: () => void): void {
    callback();
  }
}

export class Component {
  load(): void {}

  unload(): void {}
}

export class Modal extends Component {
  readonly contentEl = document.createElement("div");

  constructor(public readonly app: App) {
    super();
  }

  open(): void {
    openModals.push(this);
    this.onOpen();
  }

  close(): void {
    const index = openModals.indexOf(this);
    if (index >= 0) openModals.splice(index, 1);
    this.onClose();
  }

  onOpen(): void {}

  onClose(): void {}
}

export class MarkdownRenderer {
  static async render(
    _app: App,
    markdown: string,
    element: HTMLElement,
    _sourcePath: string,
    _component: Component
  ): Promise<void> {
    element.textContent = markdown;
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
    this.contentEl.classList.add("view-content");
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

export function getOpenModals(): readonly Modal[] {
  return openModals;
}

export function resetOpenModals(): void {
  openModals.length = 0;
}
