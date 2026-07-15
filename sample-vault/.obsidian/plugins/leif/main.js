"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => LeifPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian6 = require("obsidian");

// src/domain/types/LeifPluginData.ts
function createDefaultLeifPluginData() {
  return {
    schemaVersion: 1,
    activeContestId: null,
    contests: [],
    contestStates: [],
    subjects: [],
    topics: [],
    studyItems: [],
    studySessions: []
  };
}

// src/infrastructure/persistence/DataMigrations.ts
function deduplicateByKey(items, getKey) {
  const seen = /* @__PURE__ */ new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
function deduplicatePluginData(data) {
  return {
    ...data,
    contests: data.contests.map((contest) => ({
      ...contest,
      subjectIds: [...new Set(contest.subjectIds)]
    })),
    subjects: deduplicateByKey(data.subjects, (s) => s.id),
    topics: deduplicateByKey(data.topics, (t2) => t2.id),
    studyItems: deduplicateByKey(data.studyItems, (i) => i.id),
    studySessions: deduplicateByKey(data.studySessions, (s) => s.id),
    contestStates: deduplicateByKey(data.contestStates, (s) => s.contestId)
  };
}
var DataMigrationService = class {
  constructor() {
    this.CURRENT_VERSION = 1;
  }
  /**
   * Migrates data from any previous version to the current version.
   *
   * @param data - The data to migrate (may be from any version)
   * @returns Migrated data at the current schema version
   */
  migrate(data) {
    const version = data.schemaVersion ?? 1;
    let current = data;
    if (version < 2) {
      current = this.migrateV1toV2(current);
    }
    if (version < 3) {
      current = this.migrateV2toV3(current);
    }
    current = deduplicatePluginData(current);
    return {
      ...current,
      schemaVersion: this.CURRENT_VERSION
    };
  }
  /**
   * Migration from version 1 to version 2.
   * Add future migrations here when schema changes.
   */
  migrateV1toV2(data) {
    return data;
  }
  /**
   * Migration from version 2 to version 3.
   * Placeholder for future migrations.
   */
  migrateV2toV3(data) {
    return data;
  }
  /**
   * Gets the current schema version.
   */
  getCurrentVersion() {
    return this.CURRENT_VERSION;
  }
};

// src/infrastructure/persistence/PluginDataStore.ts
var PluginDataStore = class {
  constructor(storageAdapter) {
    this.storageAdapter = storageAdapter;
    this.migrationService = new DataMigrationService();
  }
  /**
   * Loads plugin data from storage, applying migrations if necessary.
   * 
   * @returns The loaded and migrated plugin data
   */
  async load() {
    const storedData = await this.storageAdapter.load();
    if (!storedData) {
      return createDefaultLeifPluginData();
    }
    const migratedData = this.migrationService.migrate(storedData);
    return {
      ...createDefaultLeifPluginData(),
      ...migratedData
    };
  }
  /**
   * Saves plugin data to storage.
   * 
   * @param data - The data to save
   */
  async save(data) {
    await this.storageAdapter.save(data);
  }
};

// src/infrastructure/obsidian/ObsidianStorageAdapter.ts
var ObsidianStorageAdapter = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  async load() {
    return await this.plugin.loadData();
  }
  async save(data) {
    await this.plugin.saveData(data);
  }
};

// src/ui/commands/registerCommands.ts
var import_obsidian2 = require("obsidian");

// src/ui/view/shared/DomHelpers.ts
var import_obsidian = require("obsidian");

// src/ui/i18n.ts
var ptBR = {
  "command.openView": "Abrir painel do Leif",
  "command.showActiveContest": "Mostrar concurso ativo",
  "command.seedDemoData": "Criar dados de demonstra\xE7\xE3o",
  "command.switchActiveContest": "Trocar concurso ativo",
  "command.showActiveContestSubjects": "Mostrar mat\xE9rias do concurso ativo",
  "command.reorderActiveContestSubjects": "Reordenar mat\xE9rias do concurso ativo",
  "command.toggleFirstSubjectActive": "Ativar/desativar primeira mat\xE9ria",
  "command.updateFirstSubjectConfig": "Atualizar configura\xE7\xE3o da primeira mat\xE9ria",
  "command.advanceCycle": "Avan\xE7ar ciclo",
  "command.showCycleSnapshot": "Mostrar estado do ciclo",
  "command.showActiveContestWall": "Mostrar mural do concurso ativo",
  "command.showActiveContestSummary": "Mostrar resumo do concurso ativo",
  "command.registerDemoQuestionSession": "Registrar sess\xE3o de quest\xF5es de demonstra\xE7\xE3o",
  "command.registerDemoVideoSession": "Registrar sess\xE3o de v\xEDdeo de demonstra\xE7\xE3o",
  "command.resetPluginData": "Redefinir dados do plugin",
  "tab.dashboard": "Hoje",
  "tab.contests": "Concursos",
  "tab.cycle": "Plano",
  "tab.items": "Recursos",
  "tab.topics": "Edital",
  "tab.sessions": "Registros",
  "tab.wall": "Mural",
  "action.cancel": "Cancelar",
  "action.save": "Salvar",
  "action.delete": "Excluir",
  "action.edit": "Editar",
  "action.create": "Criar",
  "action.confirm": "Confirmar",
  "action.close": "Fechar"
};
var bundle = ptBR;
function t(key) {
  return bundle[key] ?? key;
}

// src/ui/constants/index.ts
var ICON_NAMES = {
  dashboard: "calendar-check",
  contests: "trophy",
  cycle: "refresh-cw",
  items: "file-text",
  topics: "book-open",
  sessions: "clock",
  wall: "layout-grid",
  delete: "trash-2",
  add: "plus",
  edit: "pencil",
  save: "check",
  cancel: "x",
  up: "arrow-up",
  down: "arrow-down",
  toggleOn: "toggle-right",
  toggleOff: "toggle-left",
  expand: "chevron-down",
  collapse: "chevron-up",
  download: "download"
};
var TABS = [
  { id: "dashboard", label: t("tab.dashboard"), icon: ICON_NAMES.dashboard },
  { id: "cycle", label: t("tab.cycle"), icon: ICON_NAMES.cycle },
  { id: "topics", label: t("tab.topics"), icon: ICON_NAMES.topics },
  { id: "sessions", label: t("tab.sessions"), icon: ICON_NAMES.sessions },
  { id: "items", label: t("tab.items"), icon: ICON_NAMES.items },
  { id: "contests", label: t("tab.contests"), icon: ICON_NAMES.contests },
  { id: "wall", label: t("tab.wall"), icon: ICON_NAMES.wall }
];

// src/domain/errors/DomainErrors.ts
var NotFoundError = class extends Error {
  constructor(entityType, id) {
    super(`${entityType} "${id}" was not found.`);
    this.name = "NotFoundError";
  }
};
var AlreadyExistsError = class extends Error {
  constructor(entityType, id) {
    super(`${entityType} "${id}" already exists.`);
    this.name = "AlreadyExistsError";
  }
};
var NoActiveContestError = class extends Error {
  constructor() {
    super("There is no active contest.");
    this.name = "NoActiveContestError";
  }
};
var ValidationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
};

// src/ui/view/shared/DomHelpers.ts
var DomHelpers = class {
  /**
   * Creates an HTML element with optional className.
   */
  static createElement(tagName, className) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    return element;
  }
  /**
   * Creates an icon element using Obsidian's built-in Lucide icons.
   * @param iconKey - Key from ICON_NAMES constant
   * @param className - CSS class for the icon container
   * @returns HTMLElement containing the icon
   */
  static createIcon(iconKey, className = "leif-icon") {
    const container = this.createElement("span", className);
    const iconName = ICON_NAMES[iconKey] || iconKey;
    if (typeof import_obsidian.setIcon === "function") {
      (0, import_obsidian.setIcon)(container, iconName);
    } else {
      container.textContent = iconName;
      container.setAttribute("data-icon", iconName);
    }
    return container;
  }
  /**
   * Creates text with an optional icon.
   */
  static createTextWithIcon(text, icon) {
    const wrapper = this.createElement("span", "leif-text-with-icon");
    if (icon) {
      wrapper.appendChild(this.createIcon(icon));
    }
    const label = this.createElement("span", "leif-text-label");
    label.textContent = text;
    wrapper.appendChild(label);
    return wrapper;
  }
  /**
   * Creates an H1 heading with optional icon.
   */
  static createHeading(text, icon) {
    const heading = this.createElement("h1", "leif-title");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }
  /**
   * Creates an H2 section title with optional icon.
   */
  static createSectionTitle(text, icon) {
    const heading = this.createElement("h2", "leif-section-title");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }
  /**
   * Creates an H3 section subtitle with optional icon.
   */
  static createSectionSubtitle(text, icon) {
    const heading = this.createElement("h3", "leif-section-subtitle");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }
  /**
   * Creates a paragraph element.
   */
  static createParagraph(text) {
    const paragraph = this.createElement("p", "leif-paragraph");
    paragraph.textContent = text;
    return paragraph;
  }
  /**
   * Creates a strong (bold) text element.
   */
  static createStrong(text) {
    const strong = document.createElement("strong");
    strong.textContent = text;
    return strong;
  }
  /**
   * Creates a badge with optional icon.
   */
  static createBadge(text, icon) {
    const badge = this.createElement("span", "leif-badge");
    badge.appendChild(this.createTextWithIcon(text, icon));
    return badge;
  }
  /**
   * Creates a card section with title and optional icon.
   */
  static createCard(title, icon) {
    const card = this.createElement("section", "leif-card");
    card.appendChild(this.createSectionSubtitle(title, icon));
    return card;
  }
  /**
   * Creates an empty state message.
   */
  static createEmptyState(title, description) {
    const wrapper = this.createElement("section", "leif-empty-state leif-card");
    wrapper.append(this.createStrong(title), this.createParagraph(description));
    return wrapper;
  }
  /**
   * Creates an input element.
   */
  static createInput(type, placeholder, value = "") {
    const input = document.createElement("input");
    input.type = type;
    input.placeholder = placeholder;
    input.value = value;
    return input;
  }
  /**
   * Creates a select dropdown with options.
   * @param options - Array of [value, label] pairs
   * @param selectedValue - Optional value to pre-select
   */
  static createSelect(options, selectedValue) {
    const select = document.createElement("select");
    options.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if (value === selectedValue) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    return select;
  }
  /**
   * Creates a textarea element.
   */
  static createTextarea(placeholder, value = "") {
    const textarea = document.createElement("textarea");
    textarea.placeholder = placeholder;
    textarea.value = value;
    return textarea;
  }
  /**
   * Creates a label for a form control.
   */
  static createLabel(text, control) {
    const label = this.createElement("label", "setting-item");
    const span = this.createElement("span", "setting-item-name");
    const controlWrapper = this.createElement("span", "setting-item-control");
    span.textContent = text;
    controlWrapper.appendChild(control);
    label.append(span, controlWrapper);
    return label;
  }
  /**
   * Creates a vertically stacked label for larger fields.
   */
  static createStackedLabel(text, control) {
    const label = this.createElement("label", "leif-field-stack");
    const span = this.createElement("span", "leif-field-label");
    span.textContent = text;
    label.append(span, control);
    return label;
  }
  /**
   * Creates a disclosure (details/summary) element.
   */
  static createDisclosure(title, content, icon) {
    const details = this.createElement("details", "leif-disclosure");
    const summary = this.createElement("summary", "leif-disclosure-summary");
    summary.appendChild(this.createTextWithIcon(title, icon));
    details.append(summary, content);
    return details;
  }
  /**
   * Creates a key-value row display.
   */
  static createKeyValueRow(label, value) {
    const row = this.createElement("div", "leif-key-value");
    const labelEl = this.createElement("span", "leif-key-label");
    labelEl.textContent = label;
    const valueEl = this.createElement("span", "leif-key-value-text");
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    return row;
  }
  /**
   * Creates a table with headers and rows.
   * @param headers - Column headers
   * @param rows - Array of row data (each row is an array of cell content)
   */
  static createTable(headers, rows) {
    const wrapper = this.createElement("div", "leif-table-wrapper");
    const table = this.createElement("table", "leif-table");
    const thead = this.createElement("thead");
    const headerRow = this.createElement("tr");
    headers.forEach((header) => {
      const th = this.createElement("th");
      th.textContent = header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = this.createElement("tbody");
    rows.forEach((rowData) => {
      const tr = this.createElement("tr");
      rowData.forEach((cellData) => {
        const td = this.createElement("td");
        if (typeof cellData === "string") {
          td.textContent = cellData;
        } else {
          td.appendChild(cellData);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
  }
  /**
   * Creates a button with various options.
   */
  static createButton(text, options = {}) {
    const button = document.createElement("button");
    button.type = options.type || "button";
    button.className = options.className || "";
    if (options.icon) {
      button.appendChild(this.createTextWithIcon(text, options.icon));
    } else {
      button.textContent = text;
    }
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([key, value]) => {
        button.dataset[key] = value;
      });
    }
    if (options.onClick) {
      button.addEventListener("click", options.onClick);
    }
    return button;
  }
  /**
   * Creates an icon-only button with a tooltip title.
   * @param icon - Icon key from ICON_NAMES
   * @param title - Tooltip text (shown on hover)
   * @param options - Additional options (className, dataset, onClick)
   * @returns HTMLButtonElement
   */
  static createIconButton(icon, title, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = options.className || "clickable-icon";
    button.setAttribute("aria-label", title);
    button.appendChild(this.createIcon(icon));
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([key, value]) => {
        button.dataset[key] = value;
      });
    }
    if (options.onClick) {
      button.addEventListener("click", options.onClick);
    }
    if (typeof import_obsidian.setTooltip === "function") {
      (0, import_obsidian.setTooltip)(button, title, { delay: 300 });
    } else {
      button.title = title;
    }
    return button;
  }
  /**
   * Creates a form element.
   */
  static createForm(onSubmit) {
    const form = document.createElement("form");
    if (onSubmit) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        onSubmit(event);
      });
    }
    return form;
  }
  /**
   * Replaces all options in a select dropdown.
   * @param select - The select element to update
   * @param options - Array of [value, label] pairs
   * @param selectedValue - Optional value to pre-select
   */
  static replaceSelectOptions(select, options, selectedValue) {
    select.innerHTML = "";
    options.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if (selectedValue !== void 0 && value === selectedValue) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }
  /**
   * Creates a compact input for inline editing.
   */
  static createCompactInput(type, placeholder, value = "") {
    const input = this.createInput(type, placeholder, value);
    input.size = 8;
    return input;
  }
  /**
   * Creates a table with inline CRUD support.
   * Returns a container with the table.
   */
  static createCrudTable(headers) {
    const container = this.createElement("div", "leif-table-wrapper");
    const table = this.createElement("table", "leif-table");
    const thead = this.createElement("thead");
    const headerRow = this.createElement("tr");
    headers.forEach((header) => {
      const th = this.createElement("th");
      th.textContent = header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = this.createElement("tbody");
    table.appendChild(tbody);
    container.appendChild(table);
    return { container, tbody };
  }
  /**
   * Creates a standard action cell with edit and delete buttons.
   */
  static createCrudActions(onEdit, onDelete) {
    const actions = this.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(
      this.createIconButton("edit", t("action.edit"), { onClick: onEdit })
    );
    actions.appendChild(
      this.createIconButton("delete", t("action.delete"), { onClick: onDelete })
    );
    return actions;
  }
  /**
   * Creates a table cell with optional text or child element.
   */
  static createCell(text, element) {
    const td = this.createElement("td");
    if (text !== null) td.textContent = text;
    if (element) td.appendChild(element);
    return td;
  }
  /**
   * Creates an inline creation form card with cancel and submit actions.
   * @param title - Title for the form
   * @param onSubmit - Handler for form submission
   * @param onCancel - Handler for cancel action
   * @returns Form element
   */
  static createInlineForm(title, onSubmit, onCancel) {
    const card = this.createElement("section", "leif-card");
    card.appendChild(this.createSectionSubtitle(title, "add"));
    const form = this.createForm(onSubmit);
    const actions = this.createElement("div", "leif-form-actions");
    actions.appendChild(
      this.createButton(t("action.cancel"), {
        onClick: () => onCancel()
      })
    );
    actions.appendChild(
      this.createButton(t("action.create"), {
        type: "submit",
        className: "mod-cta"
      })
    );
    card.appendChild(form);
    card.appendChild(actions);
    return card;
  }
  /**
   * Displays an error notification using Obsidian's Notice.
   * Surfaces a friendlier message for NoActiveContestError.
   */
  static notifyError(error, fallbackMessage) {
    if (error instanceof NoActiveContestError) {
      new import_obsidian.Notice("Escolha um concurso para continuar.");
      return;
    }
    new import_obsidian.Notice(error instanceof Error ? error.message : fallbackMessage);
  }
  /**
   * Error-boundary helper: runs an async action and surfaces any failure
   * through notifyError so callers don't repeat try/catch + Notice boilerplate.
   */
  static runGuarded(action, fallbackMessage) {
    return (async () => {
      try {
        await action();
      } catch (error) {
        this.notifyError(error, fallbackMessage);
      }
    })();
  }
  /**
   * Creates a visual progress bar with a fill and a label.
   * @param readed - Pages readed
   * @param total - Total pages (optional)
   * @returns Progress container element
   */
  static createProgressBar(readed, total) {
    const container = this.createElement("div", "leif-progress-bar-container");
    const bar = this.createElement("div", "leif-progress-bar");
    const fill = this.createElement("div", "leif-progress-fill");
    if (total !== void 0 && total > 0) {
      const percentage = Math.min(100, Math.round(readed / total * 100));
      fill.style.width = `${percentage}%`;
      if (readed >= total) {
        fill.classList.add("is-complete");
      }
      const label = this.createElement("div", "leif-progress-label");
      const text = this.createElement("span", "leif-progress-value");
      text.textContent = `${readed}/${total} (${percentage}%)`;
      label.appendChild(text);
      container.appendChild(bar);
      container.appendChild(label);
    } else {
      const label = this.createElement("div", "leif-progress-label");
      const value = this.createElement("span", "leif-progress-value");
      value.textContent = `${readed} lido${readed === 1 ? "" : "s"}`;
      label.appendChild(value);
      container.appendChild(label);
    }
    bar.appendChild(fill);
    return container;
  }
};

// src/domain/services/CycleService.ts
var CycleService = class {
  /**
   * Generic circular navigation through a collection.
   * Returns the next item in the cycle, wrapping around to the start.
   * 
   * @param items - The collection to navigate through
   * @param currentItem - The current item (optional)
   * @param idGetter - Function to extract ID from an item
   * @returns The next item in the cycle, or null if collection is empty
   */
  getNextInCycle(items, currentItem, idGetter) {
    if (items.length === 0) {
      return null;
    }
    if (!currentItem) {
      return items[0];
    }
    const currentIndex = items.findIndex((item) => idGetter(item) === idGetter(currentItem));
    if (currentIndex === -1) {
      return items[0];
    }
    return items[(currentIndex + 1) % items.length];
  }
  /**
   * Gets the next active subject in the study cycle.
   * 
   * @param subjects - All subjects
   * @param currentSubjectId - ID of the current subject (optional)
   * @returns The next active subject, or null if no active subjects exist
   */
  getNextActiveSubject(subjects, currentSubjectId) {
    const activeSubjects = subjects.filter((subject) => subject.isActive).sort((left, right) => left.order - right.order);
    const currentSubject = currentSubjectId ? activeSubjects.find((s) => s.id === currentSubjectId) : void 0;
    return this.getNextInCycle(activeSubjects, currentSubject, (s) => s.id);
  }
  /**
   * Gets the next study item ID for a subject.
   *
   * @param subject - The subject containing items
   * @param currentItemId - ID of the current item (optional)
   * @param isCompleted - Optional predicate that returns true when an item is
   *   considered completed. When provided, the method skips completed items
   *   and returns null if every item is completed.
   * @returns The next item ID, or null if no items exist or all are completed
   */
  getNextItemId(subject, currentItemId, isCompleted) {
    if (subject.itemIds.length === 0) {
      return null;
    }
    if (!isCompleted) {
      if (!currentItemId) {
        return subject.itemIds[0];
      }
      const currentIndex2 = subject.itemIds.findIndex((itemId) => itemId === currentItemId);
      if (currentIndex2 === -1) {
        return subject.itemIds[0];
      }
      return subject.itemIds[(currentIndex2 + 1) % subject.itemIds.length];
    }
    const findNext = () => {
      for (const candidate of subject.itemIds) {
        if (!isCompleted(candidate)) {
          return candidate;
        }
      }
      return null;
    };
    if (!currentItemId) {
      return findNext();
    }
    const currentIndex = subject.itemIds.findIndex((itemId) => itemId === currentItemId);
    if (currentIndex === -1) {
      return findNext();
    }
    const total = subject.itemIds.length;
    for (let offset = 1; offset <= total; offset += 1) {
      const nextId = subject.itemIds[(currentIndex + offset) % total];
      if (!isCompleted(nextId)) {
        return nextId;
      }
    }
    return null;
  }
};

// src/domain/entities/StudySession.ts
var StudySessionType = {
  PDF: "pdf",
  VIDEO: "video",
  QUESTIONS: "questions"
};
var StudySession = class {
  constructor(id, contestId, type, studiedAt, subjectId, studyItemId, topicId, phase, reference, pagesOrCount, correctAnswers, completed) {
    this.id = id;
    this.contestId = contestId;
    this.type = type;
    this.studiedAt = studiedAt;
    this.subjectId = subjectId;
    this.studyItemId = studyItemId;
    this.topicId = topicId;
    this.phase = phase;
    this.reference = reference;
    this.pagesOrCount = pagesOrCount;
    this.correctAnswers = correctAnswers;
    this.completed = completed;
    if (!id?.trim()) throw new ValidationError("StudySession ID is required");
    if (!contestId?.trim()) throw new ValidationError("StudySession contestId is required");
    if (!type) throw new ValidationError("StudySession type is required");
    if (!studiedAt?.trim()) throw new ValidationError("StudySession studiedAt is required");
    if (pagesOrCount !== void 0 && pagesOrCount < 0) throw new ValidationError("StudySession pagesOrCount cannot be negative");
    if (correctAnswers !== void 0 && correctAnswers < 0) throw new ValidationError("StudySession correctAnswers cannot be negative");
    if (correctAnswers !== void 0 && pagesOrCount !== void 0 && correctAnswers > pagesOrCount) {
      throw new ValidationError("StudySession correctAnswers cannot exceed pagesOrCount");
    }
  }
};

// src/domain/services/ItemProgressService.ts
var ItemProgressService = class {
  /**
   * Total number of pages read across all pdf sessions for a given item.
   */
  pagesReadedFor(itemId, sessions) {
    return sessions.filter((session) => session.type === StudySessionType.PDF && session.studyItemId === itemId).reduce((total, session) => total + (session.pagesOrCount ?? 0), 0);
  }
  /**
   * True when the item has a known totalPages target and the read pages
   * meet or exceed it.
   */
  isItemCompleted(item, sessions) {
    if (item.totalPages === void 0 || item.totalPages <= 0) {
      return false;
    }
    return this.pagesReadedFor(item.id, sessions) >= item.totalPages;
  }
  /**
   * Builds a predicate that returns true when a given item id is completed
   * for the supplied set of items and sessions.
   */
  buildCompletionPredicate(items, sessions) {
    const byId = new Map(items.map((item) => [item.id, item]));
    return (itemId) => {
      const item = byId.get(itemId);
      if (!item) return false;
      return this.isItemCompleted(item, sessions);
    };
  }
};

// src/application/guards/ActiveContestGuard.ts
var ActiveContestGuard = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }
  /**
   * Requires that an active contest exists.
   * 
   * @returns The active contest ID
   * @throws {NoActiveContestError} If no active contest exists
   */
  async requireActiveContest() {
    const data = await this.dataStore.load();
    if (!data.activeContestId) {
      throw new NoActiveContestError();
    }
    return data.activeContestId;
  }
  /**
   * Gets all subjects for the active contest, sorted by order.
   * 
   * @returns Array of subjects for the active contest
   * @throws {NoActiveContestError} If no active contest exists
   */
  async getActiveContestSubjects() {
    const data = await this.dataStore.load();
    const activeContestId = await this.requireActiveContest();
    return data.subjects.filter((s) => s.contestId === activeContestId).sort((a, b) => a.order - b.order);
  }
  /**
   * Gets only active subjects for the active contest, sorted by order.
   * 
   * @returns Array of active subjects for the active contest
   * @throws {NoActiveContestError} If no active contest exists
   */
  async getActiveSubjects() {
    const subjects = await this.getActiveContestSubjects();
    return subjects.filter((s) => s.isActive);
  }
};

// src/application/use-cases/AdvanceCycleUseCase.ts
var AdvanceCycleUseCase = class {
  constructor(dataStore, cycleService = new CycleService(), progressService = new ItemProgressService()) {
    this.dataStore = dataStore;
    this.cycleService = cycleService;
    this.progressService = progressService;
    this.guard = new ActiveContestGuard(dataStore);
  }
  async execute() {
    const activeContestId = await this.guard.requireActiveContest();
    const contestSubjects = await this.guard.getActiveContestSubjects();
    const data = await this.dataStore.load();
    const currentState = data.contestStates.find((state) => state.contestId === activeContestId);
    if (!currentState) {
      throw new NotFoundError("contestStates", activeContestId);
    }
    const nextSubject = this.cycleService.getNextActiveSubject(
      contestSubjects,
      currentState.currentSubjectId ?? void 0
    );
    if (!nextSubject) {
      throw new ValidationError(`Contest "${activeContestId}" has no active subjects.`);
    }
    const subjectItems = data.studyItems.filter(
      (item) => item.subjectId === nextSubject.id
    );
    const isCompleted = this.progressService.buildCompletionPredicate(
      subjectItems,
      data.studySessions
    );
    const nextState = {
      contestId: currentState.contestId,
      currentSubjectId: nextSubject.id,
      currentItemId: this.cycleService.getNextItemId(nextSubject, void 0, isCompleted)
    };
    await this.dataStore.save({
      ...data,
      contestStates: data.contestStates.map(
        (state) => state.contestId === nextState.contestId ? nextState : state
      )
    });
    const subjectAfter = this.cycleService.getNextActiveSubject(
      contestSubjects,
      nextSubject.id
    );
    const subjectAfterItems = data.studyItems.filter(
      (item) => item.subjectId === subjectAfter?.id
    );
    const isSubjectAfterCompleted = this.progressService.buildCompletionPredicate(
      subjectAfterItems,
      data.studySessions
    );
    return {
      contestId: activeContestId,
      currentSubject: nextSubject,
      nextSubject: subjectAfter,
      currentItemId: nextState.currentItemId,
      nextItemId: subjectAfter ? this.cycleService.getNextItemId(subjectAfter, void 0, isSubjectAfterCompleted) : null,
      currentSubjectId: nextState.currentSubjectId
    };
  }
};

// src/domain/entities/Wall.ts
var Wall = class {
  constructor(noticeLinks = [], examLinks = [], subjectSnapshots = [], notes) {
    this.noticeLinks = noticeLinks;
    this.examLinks = examLinks;
    this.subjectSnapshots = subjectSnapshots;
    this.notes = notes;
  }
};
function wallLinkKey(contestId, kind) {
  return `${contestId}-${kind}`;
}

// src/domain/entities/Contest.ts
var Contest = class {
  constructor(id, name, subjectIds = [], wall = new Wall()) {
    this.id = id;
    this.name = name;
    this.subjectIds = subjectIds;
    this.wall = wall;
    if (!id?.trim()) throw new ValidationError("Contest ID is required");
    if (!name?.trim()) throw new ValidationError("Contest name is required");
  }
};

// src/domain/entities/ContestState.ts
var ContestState = class {
  constructor(contestId, currentSubjectId = null, currentItemId = null) {
    this.contestId = contestId;
    this.currentSubjectId = currentSubjectId;
    this.currentItemId = currentItemId;
    if (!contestId?.trim()) throw new ValidationError("ContestState contestId is required");
  }
};

// src/application/validation/InputValidators.ts
var ValidationResult = {
  ok() {
    return { valid: true, errors: [] };
  },
  fail(errors) {
    return { valid: false, errors };
  }
};
function requireNonEmpty(value, fieldName) {
  if (!value?.trim()) {
    return `${fieldName} is required`;
  }
  return void 0;
}
function requireNonNegative(value, fieldName) {
  if (value !== void 0 && value < 0) {
    return `${fieldName} cannot be negative`;
  }
  return void 0;
}
function requireMinLength(value, min, fieldName) {
  if (value && value.length < min) {
    return `${fieldName} must be at least ${min} characters`;
  }
  return void 0;
}
function collectErrors(...checks) {
  const errors = checks.filter((c) => c !== void 0);
  return errors.length > 0 ? ValidationResult.fail(errors) : ValidationResult.ok();
}
function requireOneOf(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    return `${fieldName} must be one of: ${allowed.join(", ")}`;
  }
  return void 0;
}
var CreateContestValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.id, "ID"),
      requireNonEmpty(input.name, "Name"),
      requireMinLength(input.name, 1, "Name")
    );
  }
};
var CreateSubjectValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.id, "ID"),
      requireNonEmpty(input.name, "Name"),
      requireNonNegative(input.plannedStudyMinutes, "Planned study minutes")
    );
  }
};
var CreateStudyItemValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.subjectId, "Subject ID"),
      requireNonEmpty(input.title, "Title"),
      requireNonNegative(input.weight, "Weight"),
      requireNonNegative(input.questionCount, "Question count")
    );
  }
};
var CreateTopicValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.id, "ID"),
      requireNonEmpty(input.subjectId, "Subject ID"),
      requireNonEmpty(input.name, "Name")
    );
  }
};
var RegisterStudySessionValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.id, "ID"),
      requireNonEmpty(input.contestId, "Contest ID"),
      requireNonEmpty(input.type, "Type"),
      requireNonEmpty(input.studiedAt, "Studied at")
    );
  }
};
var ReorderSubjectsValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.contestId, "Contest ID"),
      input.subjectIdsInOrder.length === 0 ? "Subject order list cannot be empty" : void 0
    );
  }
};
var SetActiveContestValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.contestId, "Contest ID")
    );
  }
};
var SetSubjectActiveStateValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.subjectId, "Subject ID")
    );
  }
};
var UpdateSubjectConfigurationValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.subjectId, "Subject ID"),
      requireNonNegative(input.plannedStudyMinutes, "Planned study minutes")
    );
  }
};
var DeleteStudySessionValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.sessionId, "Session ID")
    );
  }
};
var AddStudyItemResourceReferenceValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.studyItemId, "Study item ID"),
      requireNonEmpty(input.resourceReference.id, "Resource reference ID"),
      requireNonEmpty(input.resourceReference.title, "Resource reference title"),
      requireNonEmpty(input.resourceReference.type, "Resource reference type"),
      requireOneOf(input.resourceReference.type, ["pdf", "video", "link"], "Resource reference type")
    );
  }
};
var LinkQuestionNotebookValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.topicId, "Topic ID"),
      requireNonEmpty(input.questionNotebook.id, "Question notebook ID"),
      requireNonEmpty(input.questionNotebook.name, "Question notebook name"),
      requireNonEmpty(input.questionNotebook.url, "Question notebook URL")
    );
  }
};
var UpdateContestWallValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.contestId, "Contest ID")
    );
  }
};

// src/application/use-cases/CreateContestUseCase.ts
var CreateContestUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.contestRepository = repositoryFactory.for("contests");
  }
  async execute(input) {
    const validation = new CreateContestValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    const contest = new Contest(input.id, input.name, [], { noticeLinks: [], examLinks: [], subjectSnapshots: [] });
    await this.contestRepository.create(contest);
    const contestState = new ContestState(input.id);
    const data = await this.dataStore.load();
    await this.dataStore.save({
      ...data,
      activeContestId: data.activeContestId ?? contest.id,
      contestStates: [...data.contestStates, contestState]
    });
    return contest;
  }
};

// src/domain/entities/StudyItem.ts
var StudyItem = class {
  constructor(id, subjectId, title, order, weight, questionCount, resourceReferences, totalPages) {
    this.id = id;
    this.subjectId = subjectId;
    this.title = title;
    this.order = order;
    this.weight = weight;
    this.questionCount = questionCount;
    this.resourceReferences = resourceReferences;
    this.totalPages = totalPages;
    if (!id?.trim()) throw new ValidationError("StudyItem ID is required");
    if (!subjectId?.trim()) throw new ValidationError("StudyItem subjectId is required");
    if (!title?.trim()) throw new ValidationError("StudyItem title is required");
    if (order < 0) throw new ValidationError("StudyItem order cannot be negative");
    if (weight !== void 0 && weight < 0) throw new ValidationError("StudyItem weight cannot be negative");
    if (questionCount !== void 0 && questionCount < 0) throw new ValidationError("StudyItem questionCount cannot be negative");
    if (totalPages !== void 0 && totalPages < 0) throw new ValidationError("StudyItem totalPages cannot be negative");
  }
};

// src/application/Id.ts
function createId(prefix) {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${suffix}`;
}

// src/application/use-cases/CreateStudyItemUseCase.ts
var CreateStudyItemUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.subjectRepository = repositoryFactory.for("subjects");
    this.studyItemRepository = repositoryFactory.for("studyItems");
  }
  async execute(input) {
    const validation = new CreateStudyItemValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    const subject = await this.subjectRepository.findById(input.subjectId);
    const subjectItems = (await this.studyItemRepository.findAll()).filter((item) => item.subjectId === input.subjectId);
    const nextItem = new StudyItem(
      input.id ?? createId("item"),
      input.subjectId,
      input.title,
      subjectItems.length + 1,
      input.weight,
      input.questionCount,
      input.resourceReferences ?? [],
      input.totalPages
    );
    await this.studyItemRepository.create(nextItem);
    await this.subjectRepository.update(input.subjectId, (subject2) => ({
      ...subject2,
      itemIds: [...subject2.itemIds, nextItem.id]
    }));
    return nextItem;
  }
};

// src/domain/entities/Subject.ts
var Subject = class {
  constructor(id, contestId, name, order, isActive = true, plannedStudyMinutes = 0, currentStage, itemIds = [], topicIds = []) {
    this.id = id;
    this.contestId = contestId;
    this.name = name;
    this.order = order;
    this.isActive = isActive;
    this.plannedStudyMinutes = plannedStudyMinutes;
    this.currentStage = currentStage;
    this.itemIds = itemIds;
    this.topicIds = topicIds;
    if (!id?.trim()) throw new ValidationError("Subject ID is required");
    if (!contestId?.trim()) throw new ValidationError("Subject contestId is required");
    if (!name?.trim()) throw new ValidationError("Subject name is required");
    if (order < 0) throw new ValidationError("Subject order cannot be negative");
    if (plannedStudyMinutes < 0) throw new ValidationError("Subject plannedStudyMinutes cannot be negative");
  }
};

// src/application/use-cases/CreateSubjectUseCase.ts
var CreateSubjectUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.contestRepository = repositoryFactory.for("contests");
    this.subjectRepository = repositoryFactory.for("subjects");
  }
  async execute(input) {
    const validation = new CreateSubjectValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    const contest = await this.contestRepository.findById(input.contestId);
    const contestSubjects = (await this.subjectRepository.findAll()).filter((subject2) => subject2.contestId === input.contestId);
    const nextOrder = contestSubjects.length === 0 ? 1 : Math.max(...contestSubjects.map((subject2) => subject2.order)) + 1;
    const subject = new Subject(
      input.id,
      input.contestId,
      input.name,
      nextOrder,
      input.isActive ?? true,
      input.plannedStudyMinutes,
      input.currentStage,
      [],
      []
    );
    await this.subjectRepository.create(subject);
    await this.contestRepository.update(input.contestId, (contest2) => ({
      ...contest2,
      subjectIds: [...contest2.subjectIds, subject.id]
    }));
    return subject;
  }
};

// src/domain/entities/Topic.ts
var Topic = class {
  constructor(id, subjectId, name, resourceReferences = [], questionNotebook) {
    this.id = id;
    this.subjectId = subjectId;
    this.name = name;
    this.resourceReferences = resourceReferences;
    this.questionNotebook = questionNotebook;
    if (!id?.trim()) throw new ValidationError("Topic ID is required");
    if (!subjectId?.trim()) throw new ValidationError("Topic subjectId is required");
    if (!name?.trim()) throw new ValidationError("Topic name is required");
  }
};

// src/application/use-cases/CreateTopicUseCase.ts
var CreateTopicUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.topicRepository = repositoryFactory.for("topics");
    this.subjectRepository = repositoryFactory.for("subjects");
  }
  async execute(input) {
    const validation = new CreateTopicValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    await this.subjectRepository.findById(input.subjectId);
    const topic = new Topic(
      input.id,
      input.subjectId,
      input.name,
      []
    );
    await this.topicRepository.create(topic);
    await this.subjectRepository.update(input.subjectId, (subject) => ({
      ...subject,
      topicIds: [...subject.topicIds, topic.id]
    }));
    return topic;
  }
};

// src/application/use-cases/GetActiveContestSummaryUseCase.ts
var GetActiveContestSummaryUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.guard = new ActiveContestGuard(dataStore);
  }
  async execute() {
    const activeContestId = await this.guard.requireActiveContest();
    const data = await this.dataStore.load();
    const contestSubjects = await this.guard.getActiveContestSubjects();
    const subjectSummaries = contestSubjects.map((subject) => {
      const subjectSessions = data.studySessions.filter(
        (session) => session.contestId === activeContestId && session.subjectId === subject.id
      );
      const pdfProgressCount = subjectSessions.filter((session) => session.type === StudySessionType.PDF).reduce((total, session) => total + (session.pagesOrCount ?? 0), 0);
      const questionSessions = subjectSessions.filter((session) => session.type === StudySessionType.QUESTIONS);
      const questionProgressCount = questionSessions.reduce(
        (total, session) => total + (session.pagesOrCount ?? 0),
        0
      );
      const totalCorrectAnswers = questionSessions.reduce(
        (total, session) => total + (session.correctAnswers ?? 0),
        0
      );
      const rawAccuracy = questionProgressCount > 0 ? totalCorrectAnswers / questionProgressCount : 0;
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        totalSessions: subjectSessions.length,
        pdfProgressCount,
        questionProgressCount,
        questionAccuracy: questionProgressCount > 0 ? Math.min(1, rawAccuracy) : null
      };
    });
    return {
      contestId: activeContestId,
      subjectSummaries
    };
  }
};

// src/application/use-cases/GetActiveCycleSnapshotUseCase.ts
var GetActiveCycleSnapshotUseCase = class {
  constructor(dataStore, cycleService = new CycleService(), progressService = new ItemProgressService()) {
    this.dataStore = dataStore;
    this.cycleService = cycleService;
    this.progressService = progressService;
    this.guard = new ActiveContestGuard(dataStore);
  }
  async execute() {
    const activeContestId = await this.guard.requireActiveContest();
    const data = await this.dataStore.load();
    const currentState = data.contestStates.find((state) => state.contestId === activeContestId);
    if (!currentState) {
      throw new NotFoundError("contestStates", activeContestId);
    }
    const contestSubjects = await this.guard.getActiveContestSubjects();
    const currentSubject = contestSubjects.find((subject) => subject.id === currentState.currentSubjectId) ?? null;
    const nextSubject = this.cycleService.getNextActiveSubject(
      contestSubjects,
      currentState.currentSubjectId ?? void 0
    );
    const subjectForNextItem = currentSubject ?? nextSubject;
    const subjectItems = data.studyItems.filter(
      (item) => item.subjectId === subjectForNextItem?.id
    );
    const isCompleted = this.progressService.buildCompletionPredicate(
      subjectItems,
      data.studySessions
    );
    return {
      contestId: activeContestId,
      currentSubject,
      nextSubject,
      currentItemId: currentState.currentItemId,
      nextItemId: subjectForNextItem ? this.cycleService.getNextItemId(
        subjectForNextItem,
        currentSubject ? currentState.currentItemId ?? void 0 : void 0,
        isCompleted
      ) : null
    };
  }
};

// src/application/use-cases/ListSubjectsForActiveContestUseCase.ts
var ListSubjectsForActiveContestUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.guard = new ActiveContestGuard(dataStore);
  }
  async execute() {
    return await this.guard.getActiveContestSubjects();
  }
};

// src/application/use-cases/ReorderSubjectsUseCase.ts
var ReorderSubjectsUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.contestRepository = repositoryFactory.for("contests");
    this.subjectRepository = repositoryFactory.for("subjects");
  }
  async execute(input) {
    const validation = new ReorderSubjectsValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    const contest = await this.contestRepository.findById(input.contestId);
    const contestSubjects = (await this.subjectRepository.findAll()).filter((subject) => subject.contestId === input.contestId);
    if (contestSubjects.length !== input.subjectIdsInOrder.length) {
      throw new ValidationError("The provided subject order does not match the contest subject list.");
    }
    const subjectIdSet = new Set(contestSubjects.map((subject) => subject.id));
    for (const subjectId of input.subjectIdsInOrder) {
      if (!subjectIdSet.has(subjectId)) {
        throw new ValidationError(`Subject "${subjectId}" does not belong to contest "${input.contestId}".`);
      }
    }
    const updatedById = new Map(
      input.subjectIdsInOrder.map((subjectId, index) => {
        const currentSubject = contestSubjects.find((subject) => subject.id === subjectId);
        return [subjectId, { ...currentSubject, order: index + 1 }];
      })
    );
    await this.contestRepository.update(input.contestId, (contest2) => ({
      ...contest2,
      subjectIds: [...input.subjectIdsInOrder]
    }));
    const allSubjects = await this.subjectRepository.findAll();
    const updatedSubjects = allSubjects.map((subject) => updatedById.get(subject.id) ?? subject);
    await this.subjectRepository.replaceAll(updatedSubjects);
    return input.subjectIdsInOrder.map((subjectId) => updatedById.get(subjectId));
  }
};

// src/application/use-cases/RegisterStudySessionUseCase.ts
var RegisterStudySessionUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.contestRepository = repositoryFactory.for("contests");
    this.subjectRepository = repositoryFactory.for("subjects");
    this.topicRepository = repositoryFactory.for("topics");
    this.sessionRepository = repositoryFactory.for("studySessions");
  }
  async execute(input) {
    const validation = new RegisterStudySessionValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    await this.contestRepository.findById(input.contestId);
    if (input.subjectId) {
      await this.subjectRepository.findById(input.subjectId);
    }
    if (input.topicId) {
      await this.topicRepository.findById(input.topicId);
    }
    const session = new StudySession(
      input.id,
      input.contestId,
      input.type,
      input.studiedAt,
      input.subjectId,
      input.studyItemId,
      input.topicId,
      input.phase,
      input.reference,
      input.pagesOrCount,
      input.correctAnswers,
      input.completed
    );
    await this.sessionRepository.create(session);
    await this.updateTopicQuestionNotebookStats(session);
    return session;
  }
  async updateTopicQuestionNotebookStats(session) {
    if (session.type !== StudySessionType.QUESTIONS || !session.topicId) {
      return;
    }
    await this.topicRepository.update(session.topicId, (topic) => {
      if (!topic.questionNotebook) {
        return topic;
      }
      const currentSolved = topic.questionNotebook.solvedQuestions ?? 0;
      const currentCorrect = topic.questionNotebook.correctAnswers ?? 0;
      const addedSolved = session.pagesOrCount ?? 0;
      const addedCorrect = session.correctAnswers ?? 0;
      return {
        ...topic,
        questionNotebook: {
          ...topic.questionNotebook,
          solvedQuestions: currentSolved + addedSolved,
          correctAnswers: currentCorrect + addedCorrect
        }
      };
    });
  }
};

// src/application/use-cases/SetSubjectActiveStateUseCase.ts
var SetSubjectActiveStateUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.subjectRepository = repositoryFactory.for("subjects");
  }
  async execute(input) {
    const validation = new SetSubjectActiveStateValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    return await this.subjectRepository.update(input.subjectId, (subject) => ({
      ...subject,
      isActive: input.isActive
    }));
  }
};

// src/application/use-cases/SetActiveContestUseCase.ts
var SetActiveContestUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.contestRepository = repositoryFactory.for("contests");
  }
  async execute(input) {
    const validation = new SetActiveContestValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    await this.contestRepository.findById(input.contestId);
    const data = await this.dataStore.load();
    await this.dataStore.save({
      ...data,
      activeContestId: input.contestId
    });
  }
};

// src/application/use-cases/UpdateContestWallUseCase.ts
var UpdateContestWallUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.contestRepository = repositoryFactory.for("contests");
  }
  async execute(input) {
    const validation = new UpdateContestWallValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    return await this.contestRepository.update(input.contestId, (contest) => ({
      ...contest,
      wall: input.wall
    }));
  }
};

// src/application/use-cases/UpdateSubjectConfigurationUseCase.ts
var UpdateSubjectConfigurationUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.subjectRepository = repositoryFactory.for("subjects");
  }
  async execute(input) {
    const validation = new UpdateSubjectConfigurationValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    return await this.subjectRepository.update(input.subjectId, (subject) => ({
      ...subject,
      plannedStudyMinutes: input.plannedStudyMinutes ?? subject.plannedStudyMinutes,
      currentStage: input.currentStage ?? subject.currentStage
    }));
  }
};

// src/infrastructure/persistence/EntityRepository.ts
var EntityRepository = class {
  constructor(dataStore, entityKey) {
    this.dataStore = dataStore;
    this.entityKey = entityKey;
  }
  /**
   * Finds an entity by ID.
   *
   * @param id - The entity ID
   * @returns The found entity
   * @throws {NotFoundError} If the entity is not found
   */
  async findById(id) {
    const data = await this.dataStore.load();
    const entities = this.collection(data);
    const entity = entities.find((e) => e.id === id);
    if (!entity) {
      throw new NotFoundError(String(this.entityKey), id);
    }
    return entity;
  }
  /**
   * Finds all entities.
   *
   * @returns Array of all entities
   */
  async findAll() {
    const data = await this.dataStore.load();
    return this.collection(data);
  }
  /**
   * Checks if an entity exists by ID.
   *
   * @param id - The entity ID
   * @returns True if the entity exists, false otherwise
   */
  async exists(id) {
    const data = await this.dataStore.load();
    const entities = this.collection(data);
    return entities.some((e) => e.id === id);
  }
  /**
   * Creates a new entity.
   *
   * @param entity - The entity to create
   * @returns The created entity
   * @throws {AlreadyExistsError} If an entity with the same ID already exists
   */
  async create(entity) {
    const data = await this.dataStore.load();
    const entities = this.collection(data);
    if (entities.some((e) => e.id === entity.id)) {
      throw new AlreadyExistsError(String(this.entityKey), entity.id);
    }
    entities.push(entity);
    await this.dataStore.save(data);
    return entity;
  }
  /**
   * Updates an existing entity using an updater function.
   *
   * @param id - The entity ID
   * @param updater - Function that takes the entity and returns the updated version
   * @returns The updated entity
   * @throws {NotFoundError} If the entity is not found
   */
  async update(id, updater) {
    const data = await this.dataStore.load();
    const entities = this.collection(data);
    const index = entities.findIndex((e) => e.id === id);
    if (index === -1) {
      throw new NotFoundError(String(this.entityKey), id);
    }
    const updated = updater(entities[index]);
    entities[index] = updated;
    await this.dataStore.save(data);
    return updated;
  }
  /**
   * Deletes an entity by ID.
   *
   * @param id - The entity ID
   * @throws {NotFoundError} If the entity is not found
   */
  async delete(id) {
    const data = await this.dataStore.load();
    const entities = this.collection(data);
    const index = entities.findIndex((e) => e.id === id);
    if (index === -1) {
      throw new NotFoundError(String(this.entityKey), id);
    }
    entities.splice(index, 1);
    await this.dataStore.save(data);
  }
  /**
   * Replaces all entities in the collection.
   *
   * @param entities - The new entities to store
   */
  async replaceAll(entities) {
    const data = await this.dataStore.load();
    this.setCollection(data, entities);
    await this.dataStore.save(data);
  }
  /**
   * Typed accessor for this repository's collection. Centralizes the
   * single cast used to bridge {@link LeifPluginData}'s union-typed
   * arrays with the per-key {@link EntityCollections} mapping so methods
   * don't each repeat `as unknown as T[]`.
   */
  collection(data) {
    return data[this.entityKey];
  }
  setCollection(data, entities) {
    data[this.entityKey] = entities;
  }
};

// src/infrastructure/persistence/EntityRepositoryFactory.ts
var EntityRepositoryFactory = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }
  for(key) {
    return new EntityRepository(this.dataStore, key);
  }
};

// src/application/use-cases/LinkQuestionNotebookUseCase.ts
var LinkQuestionNotebookUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.topicRepository = repositoryFactory.for("topics");
  }
  async execute(input) {
    const validation = new LinkQuestionNotebookValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    return await this.topicRepository.update(input.topicId, (topic) => ({
      ...topic,
      questionNotebook: input.questionNotebook
    }));
  }
};

// src/infrastructure/persistence/Seeder.ts
function createDemoResourceReferences(subjectId, itemIndex, title) {
  const slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const references = [
    {
      id: `${subjectId}-resource-${itemIndex + 1}-pdf`,
      title: `Apostila: ${title}`,
      type: "pdf",
      url: `https://materiais.example.com/${subjectId}/${slug}.pdf`,
      notes: "Material principal para leitura e marca\xE7\xF5es."
    },
    {
      id: `${subjectId}-resource-${itemIndex + 1}-questions`,
      title: `Lista de quest\xF5es: ${title}`,
      type: "link",
      url: `https://questoes.example.com/${subjectId}/${slug}`,
      notes: "Use depois da primeira leitura."
    }
  ];
  if (itemIndex % 2 === 0) {
    references.push({
      id: `${subjectId}-resource-${itemIndex + 1}-video`,
      title: `Aula r\xE1pida: ${title}`,
      type: "video",
      url: `https://videos.example.com/${subjectId}/${slug}`,
      notes: "Revis\xE3o visual para destravar o assunto."
    });
  }
  return references;
}
var DEMO_CONTESTS = [
  {
    id: "tce-sp-2026",
    name: "TCE-SP Auditor 2026",
    wall: {
      noticeLabel: "Edital TCE-SP Auditor 2026",
      noticeUrl: "https://www.tcesp.org.br",
      examLabel: "Prova TCE-SP 2023",
      examUrl: "https://www.tcesp.org.br",
      notes: "Priorizar Portugu\xEAs, Constitucional e Controle Externo. Meta: 80 quest\xF5es por dia.\n\nCheck-list manual:\n- revisar erros de Portugu\xEAs toda sexta;\n- manter Controle Externo no ciclo mesmo quando o rendimento cair;\n- deixar Racioc\xEDnio L\xF3gico pausado at\xE9 fechar a primeira volta."
    },
    subjects: [
      {
        id: "tce-portuguese",
        name: "Portugu\xEAs",
        plannedStudyMinutes: 90,
        currentStage: "Revis\xE3o por quest\xF5es",
        items: [
          { title: "Interpreta\xE7\xE3o de textos", weight: 3, questionCount: 60, totalPages: 110 },
          { title: "Sintaxe", weight: 2, questionCount: 45, totalPages: 85 },
          { title: "Crase", weight: 2, questionCount: 32, totalPages: 48 },
          { title: "Pontua\xE7\xE3o", weight: 2, questionCount: 38, totalPages: 58 }
        ],
        topics: [
          {
            id: "tce-portuguese-interpretation",
            name: "Compreens\xE3o e interpreta\xE7\xE3o",
            notebookName: "Tec - Portugu\xEAs TCE",
            notebookUrl: "https://tec.example.com/tce-portugues"
          },
          {
            id: "tce-portuguese-syntax",
            name: "Concord\xE2ncia e reg\xEAncia",
            notebookName: "QConcursos - Sintaxe TCE",
            notebookUrl: "https://qconcursos.example.com/tce-sintaxe"
          },
          {
            id: "tce-portuguese-crase",
            name: "Uso da crase",
            notebookName: "Tec - Crase",
            notebookUrl: "https://tec.example.com/tce-crase"
          },
          {
            id: "tce-portuguese-punctuation",
            name: "Pontua\xE7\xE3o e sentido",
            notebookName: "QConcursos - Pontua\xE7\xE3o TCE",
            notebookUrl: "https://qconcursos.example.com/tce-pontuacao"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-01", count: 28 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-01", count: 40, correct: 34 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-03", count: 22 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-04", count: 35, correct: 30 },
          { item: 2, topic: 2, type: "video", date: "2026-06-09", count: 1 },
          { item: 2, topic: 2, type: StudySessionType.QUESTIONS, date: "2026-06-10", count: 28, correct: 22 },
          { item: 3, topic: 3, type: "pdf", date: "2026-06-11", count: 58 },
          { item: 3, topic: 3, type: StudySessionType.QUESTIONS, date: "2026-06-12", count: 30, correct: 26 }
        ]
      },
      {
        id: "tce-constitutional",
        name: "Direito Constitucional",
        plannedStudyMinutes: 100,
        currentStage: "Base te\xF3rica",
        items: [
          { title: "Direitos fundamentais", weight: 3, questionCount: 50, totalPages: 95 },
          { title: "Organiza\xE7\xE3o do Estado", weight: 2, questionCount: 35, totalPages: 70 }
        ],
        topics: [
          {
            id: "tce-constitutional-rights",
            name: "Direitos e garantias fundamentais",
            notebookName: "Tec - Direitos Fundamentais",
            notebookUrl: "https://tec.example.com/direitos-fundamentais"
          },
          {
            id: "tce-constitutional-state",
            name: "Organiza\xE7\xE3o pol\xEDtico-administrativa",
            notebookName: "QConcursos - Organiza\xE7\xE3o do Estado",
            notebookUrl: "https://qconcursos.example.com/organizacao-estado"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-02", count: 24 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-02", count: 30, correct: 25 },
          { item: 1, topic: 1, type: "video", date: "2026-06-05", count: 1 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-06", count: 25, correct: 20 }
        ]
      },
      {
        id: "tce-external-control",
        name: "Controle Externo",
        plannedStudyMinutes: 80,
        currentStage: "Caderno de erros",
        items: [
          { title: "Tribunais de Contas", weight: 3, questionCount: 45, totalPages: 90 },
          { title: "Fiscaliza\xE7\xE3o cont\xE1bil", weight: 2, questionCount: 30, totalPages: 65 }
        ],
        topics: [
          {
            id: "tce-control-courts",
            name: "Compet\xEAncias dos Tribunais de Contas",
            notebookName: "Tec - Controle Externo",
            notebookUrl: "https://tec.example.com/controle-externo"
          },
          {
            id: "tce-control-audit",
            name: "Auditoria governamental",
            notebookName: "Estrat\xE9gia - Auditoria TCE",
            notebookUrl: "https://estrategia.example.com/auditoria-tce"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-07", count: 18 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-07", count: 20, correct: 17 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-08", count: 20 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-08", count: 18, correct: 14 }
        ]
      },
      {
        id: "tce-logic",
        name: "Racioc\xEDnio L\xF3gico",
        plannedStudyMinutes: 45,
        isActive: false,
        currentStage: "Pausada at\xE9 fechar Portugu\xEAs",
        items: [
          { title: "Proposi\xE7\xF5es l\xF3gicas", weight: 2, questionCount: 30, totalPages: 50 },
          { title: "Diagramas l\xF3gicos", weight: 1, questionCount: 24, totalPages: 42 },
          { title: "Sequ\xEAncias e padr\xF5es", weight: 1, questionCount: 20, totalPages: 36 }
        ],
        topics: [
          {
            id: "tce-logic-propositions",
            name: "Conectivos e tabelas-verdade",
            notebookName: "Tec - L\xF3gica TCE",
            notebookUrl: "https://tec.example.com/logica-tce"
          },
          {
            id: "tce-logic-diagrams",
            name: "Diagramas l\xF3gicos",
            notebookName: "QConcursos - Diagramas",
            notebookUrl: "https://qconcursos.example.com/diagramas-logicos"
          },
          {
            id: "tce-logic-sequences",
            name: "Sequ\xEAncias num\xE9ricas",
            notebookName: "Estrat\xE9gia - Sequ\xEAncias",
            notebookUrl: "https://estrategia.example.com/sequencias"
          }
        ],
        sessions: []
      }
    ]
  },
  {
    id: "sefaz-sp-2026",
    name: "SEFAZ-SP Fiscal 2026",
    wall: {
      noticeLabel: "Edital SEFAZ-SP Fiscal 2026",
      noticeUrl: "https://portal.fazenda.sp.gov.br",
      examLabel: "Prova SEFAZ-SP 2013",
      examUrl: "https://portal.fazenda.sp.gov.br",
      notes: "Ciclo pesado em legisla\xE7\xE3o tribut\xE1ria, contabilidade e matem\xE1tica financeira."
    },
    subjects: [
      {
        id: "sefaz-tax-law",
        name: "Legisla\xE7\xE3o Tribut\xE1ria",
        plannedStudyMinutes: 120,
        items: [
          { title: "ICMS paulista", weight: 4, questionCount: 80, totalPages: 140 },
          { title: "Cr\xE9dito tribut\xE1rio", weight: 3, questionCount: 55, totalPages: 100 }
        ],
        topics: [
          {
            id: "sefaz-tax-icms",
            name: "Hip\xF3teses de incid\xEAncia do ICMS",
            notebookName: "Tec - ICMS SP",
            notebookUrl: "https://tec.example.com/icms-sp"
          },
          {
            id: "sefaz-tax-credit",
            name: "Lan\xE7amento e cr\xE9dito tribut\xE1rio",
            notebookName: "QConcursos - Cr\xE9dito Tribut\xE1rio",
            notebookUrl: "https://qconcursos.example.com/credito-tributario"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-01", count: 35 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-01", count: 45, correct: 36 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-04", count: 30 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-05", count: 35, correct: 28 }
        ]
      },
      {
        id: "sefaz-accounting",
        name: "Contabilidade",
        plannedStudyMinutes: 90,
        items: [
          { title: "Demonstra\xE7\xF5es cont\xE1beis", weight: 3, questionCount: 60, totalPages: 120 },
          { title: "An\xE1lise de balan\xE7os", weight: 2, questionCount: 40, totalPages: 85 }
        ],
        topics: [
          {
            id: "sefaz-accounting-statements",
            name: "Balan\xE7o patrimonial e DRE",
            notebookName: "Tec - Contabilidade Geral",
            notebookUrl: "https://tec.example.com/contabilidade-geral"
          },
          {
            id: "sefaz-accounting-analysis",
            name: "\xCDndices financeiros",
            notebookName: "QConcursos - An\xE1lise de Balan\xE7os",
            notebookUrl: "https://qconcursos.example.com/analise-balancos"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-02", count: 26 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-02", count: 30, correct: 24 },
          { item: 1, topic: 1, type: "video", date: "2026-06-06", count: 1 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-07", count: 25, correct: 21 }
        ]
      },
      {
        id: "sefaz-finance",
        name: "Matem\xE1tica Financeira",
        plannedStudyMinutes: 70,
        items: [
          { title: "Juros compostos", weight: 3, questionCount: 40, totalPages: 60 },
          { title: "Sistemas de amortiza\xE7\xE3o", weight: 2, questionCount: 35, totalPages: 70 }
        ],
        topics: [
          {
            id: "sefaz-finance-interest",
            name: "Taxas equivalentes",
            notebookName: "Tec - Matem\xE1tica Financeira",
            notebookUrl: "https://tec.example.com/matematica-financeira"
          },
          {
            id: "sefaz-finance-amortization",
            name: "Tabela Price e SAC",
            notebookName: "Estrat\xE9gia - Amortiza\xE7\xE3o",
            notebookUrl: "https://estrategia.example.com/amortizacao"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-03", count: 18 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-03", count: 25, correct: 19 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-08", count: 20 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-08", count: 20, correct: 15 }
        ]
      }
    ]
  },
  {
    id: "trt-2-2026",
    name: "TRT-2 Analista 2026",
    wall: {
      noticeLabel: "Edital TRT-2 Analista 2026",
      noticeUrl: "https://www.trt2.jus.br",
      examLabel: "Prova TRT-2 2018",
      examUrl: "https://www.trt2.jus.br",
      notes: "Manter recorr\xEAncia alta em trabalho, processo do trabalho e l\xEDngua portuguesa."
    },
    subjects: [
      {
        id: "trt-labor-law",
        name: "Direito do Trabalho",
        plannedStudyMinutes: 100,
        items: [
          { title: "Contrato de trabalho", weight: 3, questionCount: 55, totalPages: 105 },
          { title: "Jornada e remunera\xE7\xE3o", weight: 3, questionCount: 50, totalPages: 90 }
        ],
        topics: [
          {
            id: "trt-labor-contract",
            name: "V\xEDnculo empregat\xEDcio",
            notebookName: "Tec - Direito do Trabalho",
            notebookUrl: "https://tec.example.com/direito-trabalho"
          },
          {
            id: "trt-labor-hours",
            name: "Horas extras e adicionais",
            notebookName: "QConcursos - Jornada",
            notebookUrl: "https://qconcursos.example.com/jornada"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-01", count: 30 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-01", count: 35, correct: 29 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-05", count: 25 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-06", count: 30, correct: 24 }
        ]
      },
      {
        id: "trt-labor-procedure",
        name: "Processo do Trabalho",
        plannedStudyMinutes: 90,
        items: [
          { title: "Recursos trabalhistas", weight: 3, questionCount: 45, totalPages: 88 },
          { title: "Execu\xE7\xE3o trabalhista", weight: 2, questionCount: 35, totalPages: 72 }
        ],
        topics: [
          {
            id: "trt-procedure-appeals",
            name: "Recurso ordin\xE1rio e revista",
            notebookName: "Tec - Processo do Trabalho",
            notebookUrl: "https://tec.example.com/processo-trabalho"
          },
          {
            id: "trt-procedure-execution",
            name: "Liquida\xE7\xE3o e execu\xE7\xE3o",
            notebookName: "Estrat\xE9gia - Execu\xE7\xE3o Trabalhista",
            notebookUrl: "https://estrategia.example.com/execucao-trabalhista"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-02", count: 22 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-02", count: 25, correct: 20 },
          { item: 1, topic: 1, type: "video", date: "2026-06-07", count: 1 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-08", count: 20, correct: 16 }
        ]
      },
      {
        id: "trt-portuguese",
        name: "Portugu\xEAs",
        plannedStudyMinutes: 70,
        items: [
          { title: "Reda\xE7\xE3o oficial", weight: 2, questionCount: 30, totalPages: 55 },
          { title: "Pontua\xE7\xE3o", weight: 2, questionCount: 35, totalPages: 60 }
        ],
        topics: [
          {
            id: "trt-portuguese-official",
            name: "Comunica\xE7\xE3o oficial",
            notebookName: "Tec - Reda\xE7\xE3o Oficial",
            notebookUrl: "https://tec.example.com/redacao-oficial"
          },
          {
            id: "trt-portuguese-punctuation",
            name: "Uso da v\xEDrgula",
            notebookName: "QConcursos - Pontua\xE7\xE3o",
            notebookUrl: "https://qconcursos.example.com/pontuacao"
          }
        ],
        sessions: [
          { item: 0, topic: 0, type: "pdf", date: "2026-06-03", count: 16 },
          { item: 0, topic: 0, type: StudySessionType.QUESTIONS, date: "2026-06-03", count: 20, correct: 17 },
          { item: 1, topic: 1, type: "pdf", date: "2026-06-09", count: 18 },
          { item: 1, topic: 1, type: StudySessionType.QUESTIONS, date: "2026-06-09", count: 20, correct: 16 }
        ]
      }
    ]
  }
];
async function seedTceSpDemo(dataStore) {
  const repositoryFactory = new EntityRepositoryFactory(dataStore);
  const createContest = new CreateContestUseCase(dataStore, repositoryFactory);
  const createSubject = new CreateSubjectUseCase(dataStore, repositoryFactory);
  const createItem = new CreateStudyItemUseCase(dataStore, repositoryFactory);
  const createTopic = new CreateTopicUseCase(dataStore, repositoryFactory);
  const linkNotebook = new LinkQuestionNotebookUseCase(dataStore, repositoryFactory);
  const updateWall = new UpdateContestWallUseCase(dataStore, repositoryFactory);
  const registerSession = new RegisterStudySessionUseCase(dataStore, repositoryFactory);
  const setActive = new SetActiveContestUseCase(dataStore, repositoryFactory);
  const seededContests = [];
  for (const contestSpec of DEMO_CONTESTS) {
    const contest = await createContest.execute({ id: contestSpec.id, name: contestSpec.name });
    const seededSubjects = [];
    for (const subjectSpec of contestSpec.subjects) {
      const subject = await createSubject.execute({
        id: subjectSpec.id,
        contestId: contest.id,
        name: subjectSpec.name,
        plannedStudyMinutes: subjectSpec.plannedStudyMinutes,
        isActive: subjectSpec.isActive,
        currentStage: subjectSpec.currentStage ?? "Base"
      });
      const items = [];
      for (let index = 0; index < subjectSpec.items.length; index += 1) {
        const itemSpec = subjectSpec.items[index];
        items.push(
          await createItem.execute({
            id: `${subject.id}-item-${index + 1}`,
            subjectId: subject.id,
            title: itemSpec.title,
            weight: itemSpec.weight,
            questionCount: itemSpec.questionCount,
            totalPages: itemSpec.totalPages,
            resourceReferences: itemSpec.resourceReferences ?? createDemoResourceReferences(
              subject.id,
              index,
              itemSpec.title
            )
          })
        );
      }
      const topics = [];
      for (let index = 0; index < subjectSpec.topics.length; index += 1) {
        const topicSpec = subjectSpec.topics[index];
        const topic = await createTopic.execute({
          id: topicSpec.id,
          subjectId: subject.id,
          name: topicSpec.name
        });
        const linkedTopic = await linkNotebook.execute({
          topicId: topic.id,
          questionNotebook: {
            id: `${topic.id}-notebook`,
            name: topicSpec.notebookName,
            url: topicSpec.notebookUrl,
            solvedQuestions: 0,
            correctAnswers: 0
          }
        });
        topics.push(linkedTopic);
      }
      for (let index = 0; index < subjectSpec.sessions.length; index += 1) {
        const session = subjectSpec.sessions[index];
        await registerSession.execute({
          id: `${subject.id}-session-${index + 1}`,
          contestId: contest.id,
          subjectId: subject.id,
          studyItemId: items[session.item]?.id,
          topicId: topics[session.topic]?.id,
          type: session.type,
          studiedAt: `${session.date}T10:00:00.000Z`,
          pagesOrCount: session.count,
          correctAnswers: session.correct,
          completed: true
        });
      }
      seededSubjects.push({
        id: subject.id,
        name: subject.name,
        items,
        topics
      });
    }
    await updateWall.execute({
      contestId: contest.id,
      wall: {
        noticeLinks: [
          { id: wallLinkKey(contest.id, "notice"), label: contestSpec.wall.noticeLabel, url: contestSpec.wall.noticeUrl }
        ],
        examLinks: [
          { id: wallLinkKey(contest.id, "exam"), label: contestSpec.wall.examLabel, url: contestSpec.wall.examUrl }
        ],
        subjectSnapshots: seededSubjects.map((subject, index) => ({
          subjectId: subject.id,
          weight: contestSpec.subjects[index]?.items.reduce((total, item) => total + item.weight, 0) ?? 1,
          score: 8 - index * 0.5,
          targetItems: subject.items.map((item) => item.id)
        })),
        notes: contestSpec.wall.notes
      }
    });
    seededContests.push({
      id: contest.id,
      name: contest.name,
      subjects: seededSubjects
    });
  }
  await setActive.execute({ contestId: DEMO_CONTESTS[0].id });
  return seededContests;
}

// src/ui/commands/registerCommands.ts
function registerCommands(plugin, dataStore) {
  const repositoryFactory = new EntityRepositoryFactory(dataStore);
  const createContest = new CreateContestUseCase(dataStore, repositoryFactory);
  const createSubject = new CreateSubjectUseCase(dataStore, repositoryFactory);
  const createStudyItem = new CreateStudyItemUseCase(dataStore, repositoryFactory);
  const createTopic = new CreateTopicUseCase(dataStore, repositoryFactory);
  const updateContestWall = new UpdateContestWallUseCase(dataStore, repositoryFactory);
  const registerStudySession = new RegisterStudySessionUseCase(dataStore, repositoryFactory);
  const setActiveContest = new SetActiveContestUseCase(dataStore, repositoryFactory);
  const advanceCycle = new AdvanceCycleUseCase(dataStore);
  const getActiveCycleSnapshot = new GetActiveCycleSnapshotUseCase(dataStore);
  const getActiveContestSummary = new GetActiveContestSummaryUseCase(dataStore);
  const listSubjectsForActiveContest = new ListSubjectsForActiveContestUseCase(dataStore);
  const reorderSubjects = new ReorderSubjectsUseCase(dataStore, repositoryFactory);
  const setSubjectActiveState = new SetSubjectActiveStateUseCase(dataStore, repositoryFactory);
  const updateSubjectConfiguration = new UpdateSubjectConfigurationUseCase(dataStore, repositoryFactory);
  plugin.addCommand({
    id: "leif-show-active-contest",
    name: t("command.showActiveContest"),
    callback: async () => {
      const data = await dataStore.load();
      const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);
      new import_obsidian2.Notice(activeContest ? `Concurso escolhido: ${activeContest.name}` : "Nenhum concurso escolhido.");
    }
  });
  plugin.addCommand({
    id: "leif-seed-demo-data",
    name: t("command.seedDemoData"),
    callback: async () => {
      const data = await dataStore.load();
      if (data.contests.length > 0) {
        new import_obsidian2.Notice("O Leif j\xE1 tem dados. Mantive tudo como est\xE1.");
        return;
      }
      await seedTceSpDemo(dataStore);
      new import_obsidian2.Notice("Dados de exemplo criados.");
    }
  });
  plugin.addCommand({
    id: "leif-switch-active-contest",
    name: t("command.switchActiveContest"),
    callback: async () => {
      const data = await dataStore.load();
      if (data.contests.length === 0) {
        new import_obsidian2.Notice("Cadastre pelo menos dois concursos para alternar.");
        return;
      }
      if (data.contests.length === 1 && data.activeContestId) {
        await dataStore.save({
          ...data,
          activeContestId: null
        });
        new import_obsidian2.Notice("Nenhum concurso escolhido agora.");
        return;
      }
      const currentIndex = data.contests.findIndex((contest) => contest.id === data.activeContestId);
      const nextContest = data.contests[(currentIndex + 1 + data.contests.length) % data.contests.length];
      await setActiveContest.execute({ contestId: nextContest.id });
      new import_obsidian2.Notice(`Agora estudando: ${nextContest.name}`);
    }
  });
  plugin.addCommand({
    id: "leif-show-active-subjects",
    name: t("command.showActiveContestSubjects"),
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();
      if (subjects.length === 0) {
        new import_obsidian2.Notice("Nenhuma mat\xE9ria encontrada nesse concurso.");
        return;
      }
      new import_obsidian2.Notice(
        subjects.map((subject) => {
          const stage = subject.currentStage ?? "sem etapa";
          const state = subject.isActive ? "ativa" : "inativa";
          return `${subject.order}. ${subject.name} [${state}] ${subject.plannedStudyMinutes}m (${stage})`;
        }).join(" | ")
      );
    }
  });
  plugin.addCommand({
    id: "leif-reorder-active-subjects",
    name: t("command.reorderActiveContestSubjects"),
    callback: async () => {
      const data = await dataStore.load();
      const subjects = await listSubjectsForActiveContest.execute();
      if (!data.activeContestId || subjects.length < 2) {
        new import_obsidian2.Notice("Cadastre pelo menos duas mat\xE9rias para reordenar.");
        return;
      }
      await reorderSubjects.execute({
        contestId: data.activeContestId,
        subjectIdsInOrder: subjects.map((subject) => subject.id).reverse()
      });
      new import_obsidian2.Notice("Mat\xE9rias reordenadas.");
    }
  });
  plugin.addCommand({
    id: "leif-toggle-first-subject-active",
    name: t("command.toggleFirstSubjectActive"),
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();
      const subject = subjects[0];
      if (!subject) {
        new import_obsidian2.Notice("Nenhuma mat\xE9ria encontrada nesse concurso.");
        return;
      }
      const updatedSubject = await setSubjectActiveState.execute({
        subjectId: subject.id,
        isActive: !subject.isActive
      });
      new import_obsidian2.Notice(`${updatedSubject.name} agora est\xE1 ${updatedSubject.isActive ? "ativa" : "inativa"}.`);
    }
  });
  plugin.addCommand({
    id: "leif-update-first-subject-config",
    name: t("command.updateFirstSubjectConfig"),
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();
      const subject = subjects[0];
      if (!subject) {
        new import_obsidian2.Notice("Nenhuma mat\xE9ria encontrada nesse concurso.");
        return;
      }
      const updatedSubject = await updateSubjectConfiguration.execute({
        subjectId: subject.id,
        plannedStudyMinutes: subject.plannedStudyMinutes + 15,
        currentStage: "Revis\xE3o"
      });
      new import_obsidian2.Notice(
        `${updatedSubject.name}: ${updatedSubject.plannedStudyMinutes} min, etapa ${updatedSubject.currentStage}.`
      );
    }
  });
  plugin.addCommand({
    id: "leif-advance-cycle",
    name: t("command.advanceCycle"),
    callback: () => DomHelpers.runGuarded(async () => {
      const state = await advanceCycle.execute();
      new import_obsidian2.Notice(`Mat\xE9ria atual: ${state.currentSubjectId ?? "nenhuma"}`);
    }, "N\xE3o consegui avan\xE7ar o ciclo.")
  });
  plugin.addCommand({
    id: "leif-show-cycle-snapshot",
    name: t("command.showCycleSnapshot"),
    callback: () => DomHelpers.runGuarded(async () => {
      const snapshot = await getActiveCycleSnapshot.execute();
      const data = await dataStore.load();
      const itemMap = new Map(data.studyItems.map((item) => [item.id, item.title]));
      const currentLabel = snapshot.currentSubject?.name ?? "nenhuma";
      const nextLabel = snapshot.nextSubject?.name ?? "nenhuma";
      const currentItemLabel = snapshot.currentItemId ? itemMap.get(snapshot.currentItemId) ?? snapshot.currentItemId : "nenhum";
      const nextItemLabel = snapshot.nextItemId ? itemMap.get(snapshot.nextItemId) ?? snapshot.nextItemId : "nenhum";
      new import_obsidian2.Notice(
        `Agora: ${currentLabel} | Depois: ${nextLabel} | Item atual: ${currentItemLabel} | Pr\xF3ximo item: ${nextItemLabel}`
      );
    }, "N\xE3o consegui ler o ciclo.")
  });
  plugin.addCommand({
    id: "leif-show-active-contest-wall",
    name: t("command.showActiveContestWall"),
    callback: async () => {
      const data = await dataStore.load();
      const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);
      if (!activeContest) {
        new import_obsidian2.Notice("Nenhum concurso escolhido.");
        return;
      }
      new import_obsidian2.Notice(
        `${activeContest.name}: ${activeContest.wall.noticeLinks.length} edital, ${activeContest.wall.examLinks.length} prova, notas: ${activeContest.wall.notes ?? "nenhuma"}`
      );
    }
  });
  plugin.addCommand({
    id: "leif-show-summary",
    name: t("command.showActiveContestSummary"),
    callback: () => DomHelpers.runGuarded(async () => {
      const summary = await getActiveContestSummary.execute();
      if (summary.subjectSummaries.length === 0) {
        new import_obsidian2.Notice("Ainda n\xE3o h\xE1 resumo das mat\xE9rias nesse concurso.");
        return;
      }
      const message = summary.subjectSummaries.map((subjectSummary) => {
        const accuracy = subjectSummary.questionAccuracy === null ? "sem dados" : `${Math.round(subjectSummary.questionAccuracy * 100)}%`;
        return `${subjectSummary.subjectName}: PDF ${subjectSummary.pdfProgressCount}, quest\xF5es ${subjectSummary.questionProgressCount}, acerto ${accuracy}`;
      }).join(" | ");
      new import_obsidian2.Notice(message);
    }, "N\xE3o consegui carregar o resumo.")
  });
  plugin.addCommand({
    id: "leif-register-demo-question-session",
    name: t("command.registerDemoQuestionSession"),
    callback: async () => {
      const data = await dataStore.load();
      if (!data.activeContestId) {
        new import_obsidian2.Notice("Nenhum concurso escolhido.");
        return;
      }
      const contestState = data.contestStates.find((state) => state.contestId === data.activeContestId);
      const activeSubject = data.subjects.find((subject) => subject.id === contestState?.currentSubjectId) ?? data.subjects.find((subject) => subject.contestId === data.activeContestId);
      if (!activeSubject) {
        new import_obsidian2.Notice("Nenhuma mat\xE9ria dispon\xEDvel nesse concurso.");
        return;
      }
      const topic = data.topics.find((candidate) => candidate.subjectId === activeSubject.id);
      await registerStudySession.execute({
        id: createId("session-demo"),
        contestId: data.activeContestId,
        subjectId: activeSubject.id,
        topicId: topic?.id,
        type: StudySessionType.QUESTIONS,
        studiedAt: (/* @__PURE__ */ new Date()).toISOString(),
        pagesOrCount: 10,
        correctAnswers: 8,
        completed: true
      });
      new import_obsidian2.Notice(`Sess\xE3o de quest\xF5es criada em ${activeSubject.name}.`);
    }
  });
  plugin.addCommand({
    id: "leif-register-demo-video-session",
    name: t("command.registerDemoVideoSession"),
    callback: async () => {
      const data = await dataStore.load();
      if (!data.activeContestId) {
        new import_obsidian2.Notice("Nenhum concurso escolhido.");
        return;
      }
      const activeSubject = (await listSubjectsForActiveContest.execute())[0];
      if (!activeSubject) {
        new import_obsidian2.Notice("Nenhuma mat\xE9ria dispon\xEDvel nesse concurso.");
        return;
      }
      await registerStudySession.execute({
        id: createId("session-video"),
        contestId: data.activeContestId,
        subjectId: activeSubject.id,
        type: "video",
        studiedAt: (/* @__PURE__ */ new Date()).toISOString(),
        pagesOrCount: 1,
        completed: true
      });
      new import_obsidian2.Notice(`Sess\xE3o de v\xEDdeo criada em ${activeSubject.name}.`);
    }
  });
  plugin.addCommand({
    id: "leif-reset-demo-data",
    name: t("command.resetPluginData"),
    callback: async () => {
      await dataStore.save(createDefaultLeifPluginData());
      new import_obsidian2.Notice("Dados do Leif limpos.");
    }
  });
}

// src/ui/view/LeifView.ts
var import_obsidian5 = require("obsidian");

// src/ui/view/components/ContestsTab.ts
var import_obsidian3 = require("obsidian");

// src/application/use-cases/DeleteContestUseCase.ts
var DeleteContestUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.contestRepository = repositoryFactory.for("contests");
  }
  async execute(input) {
    const contest = await this.contestRepository.findById(input.contestId);
    const data = await this.dataStore.load();
    const subjectIds = new Set(contest.subjectIds);
    data.contests = data.contests.filter((c) => c.id !== input.contestId);
    data.contestStates = data.contestStates.filter((s) => s.contestId !== input.contestId);
    data.subjects = data.subjects.filter((s) => s.contestId !== input.contestId);
    data.studyItems = data.studyItems.filter((i) => !subjectIds.has(i.subjectId));
    data.topics = data.topics.filter((t2) => !subjectIds.has(t2.subjectId));
    data.studySessions = data.studySessions.filter((s) => s.contestId !== input.contestId);
    if (data.activeContestId === input.contestId) {
      data.activeContestId = null;
    }
    await this.dataStore.save(data);
    return contest;
  }
};

// src/application/use-cases/UpdateContestUseCase.ts
var UpdateContestUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.contestRepository = repositoryFactory.for("contests");
  }
  async execute(input) {
    return await this.contestRepository.update(input.contestId, (contest) => ({
      ...contest,
      name: input.name ?? contest.name,
      wall: {
        ...contest.wall,
        notes: input.notes ?? contest.wall.notes
      }
    }));
  }
};

// src/ui/view/components/ContestsTab.ts
var ContestsTab = class {
  constructor(dataStore, onUpdate) {
    this.dataStore = dataStore;
    this.onUpdate = onUpdate;
    this.editingContestId = null;
    this.isCreatingContest = false;
    this.pendingDeleteContestId = null;
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.createContestUseCase = new CreateContestUseCase(dataStore, repositoryFactory);
    this.setActiveContestUseCase = new SetActiveContestUseCase(dataStore, repositoryFactory);
    this.updateContestUseCase = new UpdateContestUseCase(dataStore, repositoryFactory);
    this.deleteContestUseCase = new DeleteContestUseCase(dataStore, repositoryFactory);
  }
  async render(container, data) {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Concursos"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Novo concurso", {
        onClick: async () => {
          this.isCreatingContest = true;
          await this.onUpdate();
        }
      })
    );
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph("Escolha qual concurso est\xE1 na mesa agora.")
    );
    if (this.isCreatingContest) {
      container.appendChild(this.renderCreateContestForm());
    }
    const contestsCard = DomHelpers.createCard("Seus concursos");
    if (data.contests.length === 0) {
      contestsCard.appendChild(DomHelpers.createParagraph("Nenhum concurso por aqui ainda."));
    }
    const list = DomHelpers.createElement("div", "leif-contest-list");
    data.contests.forEach((contest) => {
      const isEditing = this.editingContestId === contest.id;
      if (isEditing) {
        list.appendChild(this.renderEditableCard(contest, data));
      } else {
        list.appendChild(this.renderDisplayCard(contest, data));
      }
    });
    contestsCard.appendChild(list);
    container.appendChild(contestsCard);
  }
  renderDisplayCard(contest, data) {
    const card = DomHelpers.createElement("section", "leif-contest-card");
    card.dataset.contestCardId = contest.id;
    const isActive = data.activeContestId === contest.id;
    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    if (!isActive) {
      actions.appendChild(
        DomHelpers.createIconButton("toggleOn", "Ativar", {
          dataset: { contestId: contest.id },
          onClick: async () => {
            try {
              await this.setActiveContestUseCase.execute({ contestId: contest.id });
              new import_obsidian3.Notice(`${contest.name} agora \xE9 o concurso ativo.`);
              await this.onUpdate();
            } catch (error) {
              DomHelpers.notifyError(error, "N\xE3o consegui escolher esse concurso.");
            }
          }
        })
      );
    }
    actions.appendChild(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingContestId = contest.id;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("delete", "Excluir", {
        onClick: async () => {
          this.pendingDeleteContestId = contest.id;
          await this.onUpdate();
        }
      })
    );
    if (this.pendingDeleteContestId === contest.id) {
      actions.append(
        DomHelpers.createButton("Excluir?", {
          dataset: { contestDeleteId: contest.id },
          onClick: async () => {
            try {
              await this.deleteContestUseCase.execute({ contestId: contest.id });
              this.pendingDeleteContestId = null;
              await this.onUpdate();
            } catch (error) {
              DomHelpers.notifyError(error, "N\xE3o consegui excluir esse concurso.");
            }
          }
        }),
        DomHelpers.createButton("Cancelar", {
          onClick: async () => {
            this.pendingDeleteContestId = null;
            await this.onUpdate();
          }
        })
      );
    }
    const header = DomHelpers.createElement("div", "leif-contest-card-header");
    const titleGroup = DomHelpers.createElement("div", "leif-contest-card-title-group");
    const title = DomHelpers.createElement("strong", "leif-contest-card-title");
    title.textContent = contest.name;
    const status = DomHelpers.createElement("span", isActive ? "leif-status-active" : "leif-status-inactive");
    status.textContent = isActive ? "Estudando agora" : "Guardado";
    titleGroup.append(title, status);
    header.append(titleGroup, actions);
    const notes = DomHelpers.createParagraph(contest.wall.notes?.trim() || "Sem notas ainda.");
    const meta = DomHelpers.createElement("div", "leif-contest-meta");
    meta.append(this.renderMetaChip("ID", contest.id));
    card.append(header, notes, meta);
    return card;
  }
  renderEditableCard(contest, data) {
    const card = DomHelpers.createElement("section", "leif-contest-card is-editing");
    card.dataset.contestCardId = contest.id;
    const nameInput = DomHelpers.createTextarea("Nome", contest.name);
    nameInput.rows = 1;
    nameInput.cols = 24;
    const notesInput = DomHelpers.createTextarea("Notas", contest.wall.notes ?? "");
    notesInput.rows = 2;
    notesInput.cols = 32;
    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateContestUseCase.execute({
            contestId: contest.id,
            name: nameInput.value,
            notes: notesInput.value
          });
          this.editingContestId = null;
          await this.onUpdate();
        } catch (error) {
          DomHelpers.notifyError(error, "N\xE3o consegui salvar.");
        }
      }
    });
    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingContestId = null;
        await this.onUpdate();
      }
    });
    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    const fields = DomHelpers.createElement("div", "leif-grid leif-grid-2");
    fields.append(
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createLabel("Notas", notesInput)
    );
    const status = DomHelpers.createElement("span", data.activeContestId === contest.id ? "leif-status-active" : "leif-status-inactive");
    status.textContent = data.activeContestId === contest.id ? "Estudando agora" : "Guardado";
    card.append(
      DomHelpers.createSectionSubtitle("Editar concurso"),
      fields,
      status,
      actions
    );
    return card;
  }
  renderCreateContestForm() {
    const idInput = DomHelpers.createInput("text", "ID do concurso");
    const nameInput = DomHelpers.createInput("text", "Nome do concurso");
    const form = DomHelpers.createForm(async () => {
      try {
        await this.createContestUseCase.execute({
          id: idInput.value.trim(),
          name: nameInput.value.trim()
        });
        this.isCreatingContest = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "N\xE3o consegui criar esse concurso.");
      }
    });
    form.classList.add("leif-card");
    form.append(
      DomHelpers.createSectionSubtitle("Novo concurso"),
      DomHelpers.createLabel("ID", idInput),
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createElement("div", "leif-form-actions")
    );
    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isCreatingContest = false;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Criar", {
        type: "submit",
        className: "mod-cta"
      })
    );
    return form;
  }
  renderMetaChip(label, value) {
    const chip = DomHelpers.createElement("span", "leif-next-activity-chip");
    const labelEl = DomHelpers.createElement("span", "leif-next-activity-chip-label");
    labelEl.textContent = `${label}:`;
    const valueEl = DomHelpers.createElement("span", "leif-next-activity-chip-value");
    valueEl.textContent = value;
    chip.append(labelEl, valueEl);
    return chip;
  }
};

// src/ui/view/components/CycleTab.ts
var CycleTab = class {
  constructor(dataStore, onUpdate) {
    this.dataStore = dataStore;
    this.onUpdate = onUpdate;
    this.editingSubjectId = null;
    this.isCreatingSubject = false;
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.createSubjectUseCase = new CreateSubjectUseCase(dataStore, repositoryFactory);
    this.listSubjectsForActiveContestUseCase = new ListSubjectsForActiveContestUseCase(dataStore);
    this.reorderSubjectsUseCase = new ReorderSubjectsUseCase(dataStore, repositoryFactory);
    this.setSubjectActiveStateUseCase = new SetSubjectActiveStateUseCase(dataStore, repositoryFactory);
    this.updateSubjectConfigurationUseCase = new UpdateSubjectConfigurationUseCase(dataStore, repositoryFactory);
  }
  /**
   * Renders the cycle tab content.
   */
  async render(container, data) {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Plano"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Nova mat\xE9ria", {
        onClick: async () => {
          this.isCreatingSubject = true;
          await this.onUpdate();
        }
      })
    );
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph("Ajuste a ordem das mat\xE9rias e o tempo de cada uma.")
    );
    if (this.isCreatingSubject) {
      container.appendChild(this.renderCreateSubjectForm(data));
    }
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId) ?? null;
    const subjects = await this.listSubjectsForActiveContestUseCase.execute();
    const card = DomHelpers.createCard(
      activeContest ? `Mat\xE9rias de ${activeContest.name}` : "Mat\xE9rias"
    );
    if (subjects.length === 0) {
      card.appendChild(
        DomHelpers.createParagraph("Ainda n\xE3o h\xE1 mat\xE9rias nesse concurso.")
      );
      container.appendChild(card);
      return;
    }
    const tableWrapper = DomHelpers.createElement("div", "leif-table-wrapper");
    const table = DomHelpers.createElement("table", "leif-table");
    const thead = DomHelpers.createElement("thead");
    const headerRow = DomHelpers.createElement("tr");
    ["Ordem", "Mat\xE9ria", "Tempo", "Etapa", "Ciclo", "Editar"].forEach((header2) => {
      const th = DomHelpers.createElement("th");
      th.textContent = header2;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = DomHelpers.createElement("tbody");
    subjects.forEach((subject, index) => {
      const isEditing = this.editingSubjectId === subject.id;
      const tr = isEditing ? this.renderEditableRow(subject, subjects, index, data.activeContestId) : this.renderDisplayRow(subject, subjects, index, data.activeContestId);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    card.appendChild(tableWrapper);
    container.appendChild(card);
  }
  renderDisplayRow(subject, subjects, index, activeContestId) {
    const tr = DomHelpers.createElement("tr");
    tr.appendChild(this.renderOrderCell(subject, subjects, index, activeContestId));
    tr.appendChild(DomHelpers.createCell(subject.name));
    tr.appendChild(DomHelpers.createCell(`${subject.plannedStudyMinutes} min`));
    tr.appendChild(DomHelpers.createCell(subject.currentStage ?? "\u2014"));
    tr.appendChild(this.renderStatusCell(subject, activeContestId));
    tr.appendChild(DomHelpers.createCell(null, this.renderEditCell(subject)));
    return tr;
  }
  renderEditableRow(subject, subjects, index, activeContestId) {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-editing-row";
    const minutesInput = DomHelpers.createInput(
      "number",
      "Min",
      String(subject.plannedStudyMinutes)
    );
    minutesInput.size = 8;
    const stageInput = DomHelpers.createInput("text", "Etapa", subject.currentStage ?? "");
    stageInput.size = 12;
    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateSubjectConfigurationUseCase.execute({
            subjectId: subject.id,
            plannedStudyMinutes: Number(minutesInput.value),
            currentStage: stageInput.value
          });
          this.editingSubjectId = null;
          await this.onUpdate();
        } catch (error) {
          DomHelpers.notifyError(error, "N\xE3o consegui salvar essa mat\xE9ria.");
        }
      }
    });
    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingSubjectId = null;
        await this.onUpdate();
      }
    });
    const controls = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    controls.appendChild(saveButton);
    controls.appendChild(cancelButton);
    tr.appendChild(this.renderOrderCell(subject, subjects, index, activeContestId));
    tr.appendChild(DomHelpers.createCell(subject.name));
    tr.appendChild(DomHelpers.createCell(null, minutesInput));
    tr.appendChild(DomHelpers.createCell(null, stageInput));
    tr.appendChild(DomHelpers.createCell(subject.isActive ? "No ciclo" : "Pausada"));
    tr.appendChild(DomHelpers.createCell(null, controls));
    return tr;
  }
  renderCreateSubjectForm(data) {
    const activeContestId = data.activeContestId;
    const nameInput = DomHelpers.createInput("text", "Nome da mat\xE9ria");
    const minutesInput = DomHelpers.createInput("number", "Minutos planejados", "60");
    const form = DomHelpers.createForm(async () => {
      try {
        if (!activeContestId) {
          throw new NoActiveContestError();
        }
        await this.createSubjectUseCase.execute({
          id: createId(`${activeContestId}-subject`),
          contestId: activeContestId,
          name: nameInput.value,
          plannedStudyMinutes: Number(minutesInput.value)
        });
        this.isCreatingSubject = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "N\xE3o consegui criar essa mat\xE9ria.");
      }
    });
    form.classList.add("leif-card");
    form.append(
      DomHelpers.createSectionSubtitle("Nova mat\xE9ria"),
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createLabel("Minutos", minutesInput),
      DomHelpers.createElement("div", "leif-form-actions")
    );
    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isCreatingSubject = false;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Criar", {
        type: "submit",
        className: "mod-cta"
      })
    );
    return form;
  }
  renderStatusCell(subject, activeContestId) {
    const td = DomHelpers.createElement("td", "leif-status-cell");
    const span = DomHelpers.createElement("span", subject.isActive ? "leif-status-active" : "leif-status-inactive");
    span.textContent = subject.isActive ? "No ciclo" : "Pausada";
    td.appendChild(span);
    td.setAttribute(
      "aria-label",
      subject.isActive ? "Clique para pausar esta mat\xE9ria" : "Clique para colocar esta mat\xE9ria no ciclo"
    );
    td.title = subject.isActive ? "Clique para pausar" : "Clique para colocar no ciclo";
    td.addEventListener("click", async () => {
      try {
        await this.setSubjectActiveStateUseCase.execute({
          subjectId: subject.id,
          isActive: !subject.isActive
        });
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "N\xE3o consegui alterar essa mat\xE9ria.");
      }
    });
    return td;
  }
  renderOrderCell(subject, subjects, index, activeContestId) {
    const td = DomHelpers.createElement("td", "leif-order-cell");
    const content = DomHelpers.createElement("div", "leif-order-control");
    const order = DomHelpers.createElement("span", "leif-order-number");
    const buttons = DomHelpers.createElement("div", "leif-order-actions");
    order.textContent = String(subject.order);
    content.appendChild(order);
    if (index > 0) {
      buttons.appendChild(
        DomHelpers.createIconButton("up", "Subir", {
          onClick: async () => {
            await this.moveSubject(subjects, index, index - 1, activeContestId);
          }
        })
      );
    }
    if (index < subjects.length - 1) {
      buttons.appendChild(
        DomHelpers.createIconButton("down", "Descer", {
          onClick: async () => {
            await this.moveSubject(subjects, index, index + 1, activeContestId);
          }
        })
      );
    }
    content.appendChild(buttons);
    td.appendChild(content);
    return td;
  }
  renderEditCell(subject) {
    const cell = DomHelpers.createElement("div", "leif-edit-cell");
    cell.appendChild(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingSubjectId = subject.id;
          await this.onUpdate();
        }
      })
    );
    return cell;
  }
  async moveSubject(subjects, sourceIndex, targetIndex, activeContestId) {
    try {
      if (!activeContestId) {
        throw new NoActiveContestError();
      }
      const nextOrder = subjects.map((subject) => subject.id);
      const [subjectId] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, subjectId);
      await this.reorderSubjectsUseCase.execute({
        contestId: activeContestId,
        subjectIdsInOrder: nextOrder
      });
      await this.onUpdate();
    } catch (error) {
      DomHelpers.notifyError(error, "N\xE3o consegui reordenar as mat\xE9rias.");
    }
  }
};

// src/application/use-cases/GetActiveContestProgressDashboardUseCase.ts
var GetActiveContestProgressDashboardUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.guard = new ActiveContestGuard(dataStore);
  }
  async execute() {
    const activeContestId = await this.guard.requireActiveContest();
    const data = await this.dataStore.load();
    const contestSubjects = await this.guard.getActiveContestSubjects();
    const pdfProgressBySubject = contestSubjects.map((subject) => {
      const subjectItems = data.studyItems.filter((studyItem) => studyItem.subjectId === subject.id).sort((left, right) => left.order - right.order);
      const items = subjectItems.map((studyItem) => {
        const pagesReaded = data.studySessions.filter(
          (session) => session.contestId === activeContestId && session.type === StudySessionType.PDF && session.studyItemId === studyItem.id
        ).reduce((total, session) => total + (session.pagesOrCount ?? 0), 0);
        return {
          studyItemId: studyItem.id,
          title: studyItem.title,
          order: studyItem.order,
          progressCount: pagesReaded,
          pagesReaded,
          totalPages: studyItem.totalPages,
          completed: studyItem.totalPages !== void 0 && studyItem.totalPages > 0 ? pagesReaded >= studyItem.totalPages : false,
          weight: studyItem.weight,
          questionCount: studyItem.questionCount
        };
      });
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        items,
        totalProgressCount: items.reduce((total, item) => total + item.progressCount, 0)
      };
    });
    const questionProgressBySubject = contestSubjects.map((subject) => {
      const groupedByDate = /* @__PURE__ */ new Map();
      data.studySessions.filter(
        (session) => session.contestId === activeContestId && session.subjectId === subject.id && session.type === StudySessionType.QUESTIONS
      ).forEach((session) => {
        const date = session.studiedAt.slice(0, 10);
        const current = groupedByDate.get(date) ?? { questionCount: 0, correctAnswers: 0 };
        groupedByDate.set(date, {
          questionCount: current.questionCount + (session.pagesOrCount ?? 0),
          correctAnswers: current.correctAnswers + (session.correctAnswers ?? 0)
        });
      });
      const points = Array.from(groupedByDate.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, point]) => ({
        date,
        questionCount: point.questionCount,
        correctAnswers: point.correctAnswers,
        accuracy: point.questionCount > 0 ? point.correctAnswers / point.questionCount : null
      }));
      const totalQuestionCount = points.reduce((total, point) => total + point.questionCount, 0);
      const totalCorrectAnswers = points.reduce((total, point) => total + point.correctAnswers, 0);
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        points,
        totalQuestionCount,
        totalCorrectAnswers,
        totalAccuracy: totalQuestionCount > 0 ? totalCorrectAnswers / totalQuestionCount : null
      };
    });
    return {
      contestId: activeContestId,
      pdfProgressBySubject,
      questionProgressBySubject
    };
  }
};

// src/ui/view/components/DashboardTab.ts
var DashboardTab = class {
  constructor(dataStore, onUpdate) {
    this.dataStore = dataStore;
    this.onUpdate = onUpdate;
    this.isRegisteringNextActivity = false;
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.getActiveCycleSnapshotUseCase = new GetActiveCycleSnapshotUseCase(dataStore);
    this.getActiveContestSummaryUseCase = new GetActiveContestSummaryUseCase(dataStore);
    this.getActiveContestProgressDashboardUseCase = new GetActiveContestProgressDashboardUseCase(dataStore);
    this.registerStudySessionUseCase = new RegisterStudySessionUseCase(dataStore, repositoryFactory);
  }
  /**
   * Renders the dashboard tab content.
   */
  async render(container, data) {
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId) ?? null;
    if (!activeContest) {
      container.append(
        DomHelpers.createSectionTitle("Hoje"),
        DomHelpers.createEmptyState(
          "Nada escolhido ainda",
          "Escolha um concurso para o Leif saber por onde come\xE7ar."
        )
      );
      return;
    }
    const snapshot = await this.getActiveCycleSnapshotUseCase.execute();
    const summary = await this.getActiveContestSummaryUseCase.execute();
    const progress = await this.getActiveContestProgressDashboardUseCase.execute();
    const itemMap = new Map(data.studyItems.map((item) => [item.id, item.title]));
    const recommendedSubject = snapshot.currentSubject ?? snapshot.nextSubject;
    const afterRecommendedSubject = snapshot.currentSubject && snapshot.nextSubject?.id !== snapshot.currentSubject.id ? snapshot.nextSubject : this.findFollowingActiveSubject(data, activeContest.id, recommendedSubject?.id);
    const recommendedItemId = snapshot.currentItemId ?? snapshot.nextItemId;
    const afterRecommendedItemId = snapshot.currentItemId ? snapshot.nextItemId : null;
    container.appendChild(DomHelpers.createSectionTitle("Hoje"));
    container.appendChild(
      DomHelpers.createParagraph("O que estudar agora e como o dia est\xE1 andando.")
    );
    container.appendChild(
      this.renderNextActivityPanel({
        subjectName: recommendedSubject?.name ?? "Sem mat\xE9ria ativa",
        itemName: recommendedSubject ? itemMap.get(recommendedItemId ?? "") ?? "Sem item definido" : "Crie ou ative uma mat\xE9ria no Plano para aparecer aqui.",
        plannedMinutes: recommendedSubject?.plannedStudyMinutes,
        stage: recommendedSubject?.currentStage,
        nextSubjectName: afterRecommendedSubject?.name,
        nextItemName: itemMap.get(afterRecommendedItemId ?? ""),
        onRegister: recommendedSubject ? async () => {
          this.isRegisteringNextActivity = true;
          await this.onUpdate();
        } : void 0,
        registerForm: this.isRegisteringNextActivity && recommendedSubject ? this.renderRecommendedSessionForm({
          contestId: activeContest.id,
          subjectId: recommendedSubject.id,
          subjectName: recommendedSubject.name,
          itemId: recommendedItemId ?? void 0,
          itemName: itemMap.get(recommendedItemId ?? "") ?? void 0
        }) : void 0
      })
    );
    const subjectSummaryCard = DomHelpers.createCard("Resumo por mat\xE9ria");
    const progressMap = new Map(progress.pdfProgressBySubject.map((s) => [s.subjectId, s]));
    const rows = summary.subjectSummaries.map((subjectSummary) => {
      const subjectProgress = progressMap.get(subjectSummary.subjectId);
      const totalPages = subjectProgress?.items.reduce((sum, item) => sum + (item.totalPages ?? 0), 0) ?? 0;
      const readPages = subjectProgress?.totalProgressCount ?? 0;
      const progressBar = DomHelpers.createProgressBar(readPages, totalPages > 0 ? totalPages : void 0);
      return [
        subjectSummary.subjectName,
        String(subjectSummary.totalSessions),
        progressBar,
        String(subjectSummary.questionProgressCount),
        subjectSummary.questionAccuracy === null ? "-" : `${Math.round(subjectSummary.questionAccuracy * 100)}%`
      ];
    });
    if (rows.length === 0) {
      subjectSummaryCard.appendChild(
        DomHelpers.createParagraph("Quando voc\xEA come\xE7ar a registrar estudos, o resumo aparece aqui.")
      );
    } else {
      subjectSummaryCard.appendChild(
        DomHelpers.createTable(
          ["Mat\xE9ria", "Sess\xF5es", "P\xE1ginas", "Quest\xF5es", "Acerto"],
          rows
        )
      );
    }
    container.appendChild(subjectSummaryCard);
  }
  renderNextActivityPanel(activity) {
    const panel = DomHelpers.createElement("section", "leif-next-activity");
    const intro = DomHelpers.createElement("div", "leif-next-activity-intro");
    const label = DomHelpers.createElement("span", "leif-next-activity-label");
    label.textContent = "Estudar agora";
    const subject = DomHelpers.createElement("strong", "leif-next-activity-subject");
    subject.textContent = activity.subjectName;
    const item = DomHelpers.createElement("span", "leif-next-activity-item");
    item.textContent = activity.itemName;
    intro.append(label, subject, item);
    const meta = DomHelpers.createElement("div", "leif-next-activity-meta");
    meta.append(
      this.renderActivityMeta("Tempo", activity.plannedMinutes ? `${activity.plannedMinutes} min` : "sem tempo definido"),
      this.renderActivityMeta("Etapa", activity.stage?.trim() ? activity.stage : "sem etapa")
    );
    if (activity.nextSubjectName || activity.nextItemName) {
      const next = DomHelpers.createElement("div", "leif-next-activity-next");
      next.textContent = [
        activity.nextSubjectName ? `Depois vem ${activity.nextSubjectName}` : void 0,
        activity.nextItemName ? `na fila: ${activity.nextItemName}` : void 0
      ].filter(Boolean).join(" \xB7 ");
      meta.appendChild(next);
    }
    if (activity.onRegister) {
      meta.appendChild(
        DomHelpers.createButton("Registrar agora", {
          className: "mod-cta",
          onClick: activity.onRegister
        })
      );
    }
    panel.append(intro, meta);
    if (activity.registerForm) {
      panel.appendChild(activity.registerForm);
    }
    return panel;
  }
  renderActivityMeta(label, value) {
    const item = DomHelpers.createElement("span", "leif-next-activity-chip");
    const labelEl = DomHelpers.createElement("span", "leif-next-activity-chip-label");
    labelEl.textContent = `${label}:`;
    const valueEl = DomHelpers.createElement("span", "leif-next-activity-chip-value");
    valueEl.textContent = value;
    item.append(labelEl, valueEl);
    return item;
  }
  findFollowingActiveSubject(data, contestId, subjectId) {
    if (!subjectId) return null;
    const activeSubjects = data.subjects.filter((subject) => subject.contestId === contestId && subject.isActive).slice().sort((a, b) => a.order - b.order);
    if (activeSubjects.length < 2) return null;
    const currentIndex = activeSubjects.findIndex((subject) => subject.id === subjectId);
    if (currentIndex === -1) return null;
    return activeSubjects[(currentIndex + 1) % activeSubjects.length] ?? null;
  }
  renderRecommendedSessionForm(activity) {
    const typeSelect = DomHelpers.createSelect([
      [StudySessionType.PDF, "PDF"],
      [StudySessionType.VIDEO, "V\xEDdeo"],
      [StudySessionType.QUESTIONS, "Quest\xF5es"]
    ]);
    const countInput = DomHelpers.createInput("number", "P\xE1ginas ou quantidade", "0");
    const correctInput = DomHelpers.createInput("number", "Acertos", "0");
    const correctLabel = DomHelpers.createLabel("Acertos", correctInput);
    const dateInput = DomHelpers.createInput("date", "Data");
    dateInput.value = this.getDefaultDateValue();
    const syncQuestionField = () => {
      correctLabel.style.display = typeSelect.value === StudySessionType.QUESTIONS ? "" : "none";
    };
    typeSelect.addEventListener("change", syncQuestionField);
    syncQuestionField();
    const form = DomHelpers.createForm(async () => {
      try {
        const sessionType = typeSelect.value;
        const rawCount = Number(countInput.value);
        const rawCorrect = Number(correctInput.value);
        if (sessionType === StudySessionType.QUESTIONS && (!rawCount || rawCount <= 0)) {
          throw new ValidationError("Informe uma quantidade de quest\xF5es maior que zero.");
        }
        await this.registerStudySessionUseCase.execute({
          id: createId("session"),
          contestId: activity.contestId,
          subjectId: activity.subjectId,
          studyItemId: activity.itemId,
          type: sessionType,
          studiedAt: dateInput.value,
          pagesOrCount: sessionType === StudySessionType.QUESTIONS ? rawCount : rawCount || void 0,
          correctAnswers: sessionType === StudySessionType.QUESTIONS ? Math.min(rawCorrect, rawCount) : void 0,
          completed: true
        });
        this.isRegisteringNextActivity = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "N\xE3o consegui salvar esse registro.");
      }
    });
    const context = DomHelpers.createElement("div", "leif-stack");
    context.append(
      DomHelpers.createKeyValueRow("Mat\xE9ria", activity.subjectName),
      DomHelpers.createKeyValueRow("Item", activity.itemName ?? "Sem item definido")
    );
    const fields = DomHelpers.createElement("div", "leif-grid leif-grid-2");
    fields.append(
      DomHelpers.createLabel("Tipo", typeSelect),
      DomHelpers.createLabel("Quantidade", countInput),
      correctLabel,
      DomHelpers.createLabel("Data", dateInput)
    );
    const actions = DomHelpers.createElement("div", "leif-form-actions");
    actions.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isRegisteringNextActivity = false;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Registrar", {
        className: "mod-cta",
        onClick: () => form.requestSubmit()
      })
    );
    form.append(context, fields, actions);
    return form;
  }
  getDefaultDateValue() {
    const now = /* @__PURE__ */ new Date();
    const timezoneOffset = now.getTimezoneOffset() * 6e4;
    const localDate = new Date(now.getTime() - timezoneOffset);
    return localDate.toISOString().split("T")[0];
  }
};

// src/application/use-cases/AddStudyItemResourceReferenceUseCase.ts
var AddStudyItemResourceReferenceUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.studyItemRepository = repositoryFactory.for("studyItems");
  }
  async execute(input) {
    const validation = new AddStudyItemResourceReferenceValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    return await this.studyItemRepository.update(input.studyItemId, (studyItem) => ({
      ...studyItem,
      resourceReferences: [...studyItem.resourceReferences ?? [], input.resourceReference]
    }));
  }
};

// src/application/use-cases/DeleteStudyItemUseCase.ts
var DeleteStudyItemUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.itemRepository = repositoryFactory.for("studyItems");
    this.subjectRepository = repositoryFactory.for("subjects");
  }
  async execute(input) {
    const item = await this.itemRepository.findById(input.itemId);
    await this.itemRepository.delete(input.itemId);
    await this.subjectRepository.update(item.subjectId, (subject) => ({
      ...subject,
      itemIds: subject.itemIds.filter((id) => id !== input.itemId)
    }));
    return item;
  }
};

// src/application/use-cases/UpdateStudyItemUseCase.ts
var UpdateStudyItemUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.itemRepository = repositoryFactory.for("studyItems");
  }
  async execute(input) {
    if (!input.itemId?.trim()) {
      throw new ValidationError("itemId is required");
    }
    if (input.title !== void 0 && !input.title.trim()) {
      throw new ValidationError("title is required");
    }
    if (input.weight !== void 0 && input.weight < 0) {
      throw new ValidationError("weight cannot be negative");
    }
    if (input.questionCount !== void 0 && input.questionCount < 0) {
      throw new ValidationError("questionCount cannot be negative");
    }
    if (input.totalPages !== void 0 && input.totalPages < 0) {
      throw new ValidationError("totalPages cannot be negative");
    }
    return await this.itemRepository.update(input.itemId, (item) => ({
      ...item,
      title: input.title !== void 0 ? input.title.trim() : item.title,
      weight: input.weight !== void 0 ? input.weight : item.weight,
      questionCount: input.questionCount !== void 0 ? input.questionCount : item.questionCount,
      totalPages: input.totalPages !== void 0 ? input.totalPages : item.totalPages,
      resourceReferences: input.resourceReferences !== void 0 ? input.resourceReferences : item.resourceReferences
    }));
  }
};

// src/ui/view/shared/SubjectPicker.ts
var SubjectPicker = class {
  static getSelectedSubject(data, selectedSubjectId) {
    const subjects = data.subjects.filter((subject) => subject.contestId === data.activeContestId).sort((left, right) => left.order - right.order);
    if (subjects.length === 0) return null;
    return subjects.find((subject) => subject.id === selectedSubjectId) ?? subjects[0];
  }
  static create(data, selectedSubjectId, onChange) {
    const subjects = data.subjects.filter((subject) => subject.contestId === data.activeContestId).sort((left, right) => left.order - right.order);
    const select = DomHelpers.createSelect(
      subjects.map((subject) => [subject.id, subject.name]),
      selectedSubjectId ?? void 0
    );
    select.addEventListener("change", () => {
      void onChange(select.value);
    });
    const wrapper = DomHelpers.createElement("div", "leif-subject-picker");
    const label = DomHelpers.createElement("span", "leif-subject-picker-label");
    label.textContent = "Mat\xE9ria";
    wrapper.append(label, select);
    return wrapper;
  }
};

// src/ui/view/components/ItemsTab.ts
var ItemsTab = class {
  constructor(dataStore, onUpdate) {
    this.dataStore = dataStore;
    this.onUpdate = onUpdate;
    this.selectedSubjectId = null;
    this.editingItemId = null;
    this.expandedItemId = null;
    this.isCreatingItem = false;
    this.pendingDeleteItemId = null;
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.createStudyItemUseCase = new CreateStudyItemUseCase(dataStore, repositoryFactory);
    this.addStudyItemResourceReferenceUseCase = new AddStudyItemResourceReferenceUseCase(dataStore, repositoryFactory);
    this.getActiveContestProgressDashboardUseCase = new GetActiveContestProgressDashboardUseCase(dataStore);
    this.deleteStudyItemUseCase = new DeleteStudyItemUseCase(dataStore, repositoryFactory);
    this.updateStudyItemUseCase = new UpdateStudyItemUseCase(dataStore, repositoryFactory);
  }
  async render(container, data) {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Recursos"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Novo item", {
        onClick: async () => {
          this.isCreatingItem = true;
          await this.onUpdate();
        }
      })
    );
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph(
        "Guarde materiais de estudo por mat\xE9ria \u2014 PDFs, v\xEDdeos e links \u2014 e acompanhe o avan\xE7o de leitura sem sair do Obsidian."
      )
    );
    const subject = SubjectPicker.getSelectedSubject(data, this.selectedSubjectId);
    if (!subject) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Sem mat\xE9ria escolhida",
          "Crie uma mat\xE9ria no Plano para adicionar recursos."
        )
      );
      return;
    }
    container.appendChild(
      SubjectPicker.create(data, this.selectedSubjectId, async (subjectId) => {
        this.selectedSubjectId = subjectId;
        await this.onUpdate();
      })
    );
    if (this.isCreatingItem) {
      container.appendChild(this.renderCreateItemForm(subject.id));
    }
    const progress = await this.getActiveContestProgressDashboardUseCase.execute();
    const subjectProgress = progress.pdfProgressBySubject.find(
      (entry) => entry.subjectId === subject.id
    );
    const items = data.studyItems.filter((item) => item.subjectId === subject.id).sort((left, right) => left.order - right.order);
    const card = DomHelpers.createCard(`Itens de ${subject.name}`);
    if (items.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Nenhum recurso cadastrado nessa mat\xE9ria."));
      container.appendChild(card);
      return;
    }
    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Ordem",
      "Recurso",
      "Peso",
      "Quest\xF5es",
      "P\xE1ginas",
      "A\xE7\xF5es"
    ]);
    items.forEach((item) => {
      const itemProgress = subjectProgress?.items.find(
        (entry) => entry.studyItemId === item.id
      );
      const isEditing = this.editingItemId === item.id;
      const isExpanded = this.expandedItemId === item.id;
      if (isEditing) {
        tbody.appendChild(this.renderEditableRow(item));
        tbody.appendChild(this.renderEditMaterialsRow(item));
      } else {
        tbody.appendChild(this.renderDisplayRow(item, itemProgress));
      }
      if (isExpanded && !isEditing) {
        tbody.appendChild(this.renderDetailRow(item));
      }
    });
    card.appendChild(tableContainer);
    container.appendChild(card);
  }
  renderDisplayRow(item, itemProgress) {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.itemId = item.id;
    const refs = item.resourceReferences ?? [];
    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    const hasRefs = refs.length > 0;
    actions.appendChild(
      DomHelpers.createIconButton(
        this.expandedItemId === item.id ? "collapse" : "expand",
        this.expandedItemId === item.id ? "Recolher" : "Expandir",
        {
          className: `clickable-icon ${hasRefs ? "" : "leif-expand-button"}`,
          onClick: async () => {
            this.expandedItemId = this.expandedItemId === item.id ? null : item.id;
            await this.onUpdate();
          }
        }
      )
    );
    actions.appendChild(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingItemId = item.id;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("delete", "Excluir", {
        onClick: async () => {
          this.pendingDeleteItemId = item.id;
          await this.onUpdate();
        }
      })
    );
    if (this.pendingDeleteItemId === item.id) {
      actions.append(
        DomHelpers.createButton("Excluir?", {
          onClick: async () => {
            try {
              await this.deleteStudyItemUseCase.execute({ itemId: item.id });
              this.pendingDeleteItemId = null;
              await this.onUpdate();
            } catch (error) {
              DomHelpers.notifyError(error, "N\xE3o consegui excluir esse recurso.");
            }
          }
        }),
        DomHelpers.createButton("Cancelar", {
          onClick: async () => {
            this.pendingDeleteItemId = null;
            await this.onUpdate();
          }
        })
      );
    }
    const title = DomHelpers.createElement("strong", "leif-resource-table-title");
    title.textContent = item.title;
    const titleCell = DomHelpers.createCell(null, title);
    titleCell.classList.add("leif-resource-title-cell");
    tr.append(
      DomHelpers.createCell(String(item.order)),
      titleCell,
      DomHelpers.createCell(String(item.weight ?? 0)),
      DomHelpers.createCell(String(item.questionCount ?? 0)),
      DomHelpers.createCell(null, this.renderPagesCell(item, itemProgress)),
      DomHelpers.createCell(null, actions)
    );
    return tr;
  }
  renderEditableRow(item) {
    const tr = DomHelpers.createElement("tr", "leif-editing-row");
    tr.dataset.itemId = item.id;
    const titleInput = DomHelpers.createCompactInput("text", "T\xEDtulo", item.title);
    const weightInput = DomHelpers.createCompactInput("number", "Peso", String(item.weight ?? 0));
    const questionInput = DomHelpers.createCompactInput("number", "Qts", String(item.questionCount ?? 0));
    const totalPagesInput = DomHelpers.createCompactInput("number", "Total", String(item.totalPages ?? ""));
    titleInput.classList.add("leif-resource-edit-input");
    weightInput.classList.add("leif-resource-edit-input");
    questionInput.classList.add("leif-resource-edit-input");
    totalPagesInput.classList.add("leif-resource-edit-input");
    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          const rawPages = totalPagesInput.value.trim();
          await this.updateStudyItemUseCase.execute({
            itemId: item.id,
            title: titleInput.value,
            weight: Number(weightInput.value),
            questionCount: Number(questionInput.value),
            totalPages: rawPages === "" ? void 0 : Number(rawPages)
          });
          this.editingItemId = null;
          await this.onUpdate();
        } catch (error) {
          DomHelpers.notifyError(error, "N\xE3o consegui salvar.");
        }
      }
    });
    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingItemId = null;
        await this.onUpdate();
      }
    });
    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    tr.append(
      DomHelpers.createCell(String(item.order)),
      DomHelpers.createCell(null, titleInput),
      DomHelpers.createCell(null, weightInput),
      DomHelpers.createCell(null, questionInput),
      DomHelpers.createCell(null, totalPagesInput),
      DomHelpers.createCell(null, actions)
    );
    return tr;
  }
  renderDetailRow(item) {
    const tr = DomHelpers.createElement("tr", "leif-detail-row");
    const td = DomHelpers.createElement("td");
    td.colSpan = 6;
    td.appendChild(this.renderDetailContent(item));
    tr.appendChild(td);
    return tr;
  }
  renderEditMaterialsRow(item) {
    const tr = DomHelpers.createElement("tr", "leif-detail-row leif-resource-edit-materials");
    const td = DomHelpers.createElement("td");
    td.colSpan = 6;
    const content = DomHelpers.createElement("div", "leif-detail-content");
    const references = item.resourceReferences ?? [];
    const materialSection = DomHelpers.createElement("section", "leif-resource-material-section");
    materialSection.append(
      DomHelpers.createSectionSubtitle("Materiais do recurso"),
      DomHelpers.createParagraph("Edite ou remova os materiais j\xE1 ligados a este recurso.")
    );
    if (references.length > 0) {
      const list = DomHelpers.createElement("div", "leif-resource-material-editor-list");
      references.forEach((reference) => {
        list.appendChild(this.renderMaterialEditor(item, reference));
      });
      materialSection.appendChild(list);
    } else {
      materialSection.appendChild(
        DomHelpers.createParagraph("Nenhum material vinculado ainda.")
      );
    }
    const addSection = DomHelpers.createElement("section", "leif-resource-material-section");
    addSection.append(
      DomHelpers.createSectionSubtitle("Adicionar novo material"),
      DomHelpers.createParagraph("Use esta \xE1rea para anexar PDF, v\xEDdeo ou link ao recurso em edi\xE7\xE3o."),
      this.renderAddMaterialForm(item)
    );
    content.append(
      materialSection,
      addSection
    );
    td.appendChild(content);
    tr.appendChild(td);
    return tr;
  }
  renderPagesCell(item, progress) {
    const cell = DomHelpers.createElement("div", "leif-pages-cell");
    const readed = progress?.pagesReaded ?? 0;
    const total = item.totalPages;
    const progressBar = DomHelpers.createProgressBar(readed, total);
    cell.appendChild(progressBar);
    if (progress?.completed) {
      const badge = DomHelpers.createElement("span", "leif-pages-completed");
      badge.textContent = "\u2713 Conclu\xEDdo";
      cell.appendChild(badge);
    }
    return cell;
  }
  renderDetailContent(item) {
    const content = DomHelpers.createElement("div", "leif-detail-content");
    content.classList.add("leif-resource-detail");
    const header = DomHelpers.createElement("div", "leif-resource-detail-header");
    const titleGroup = DomHelpers.createElement("div", "leif-resource-detail-title-group");
    titleGroup.append(
      DomHelpers.createSectionSubtitle("Materiais deste recurso"),
      DomHelpers.createParagraph("Arquivos, aulas e links j\xE1 conectados a este recurso.")
    );
    header.appendChild(titleGroup);
    content.appendChild(header);
    if (item.resourceReferences && item.resourceReferences.length > 0) {
      const list = DomHelpers.createElement("div", "leif-detail-list");
      item.resourceReferences.forEach((ref) => {
        const row = DomHelpers.createElement("div", "leif-detail-list-item leif-material-row");
        const materialInfo = DomHelpers.createElement("div", "leif-material-info");
        const type = DomHelpers.createElement("span", "leif-material-type");
        type.textContent = this.formatResourceType(ref.type);
        const title = DomHelpers.createElement("span", "leif-material-title");
        title.textContent = ref.title;
        materialInfo.append(type, title);
        row.appendChild(materialInfo);
        if (ref.url) {
          const link = DomHelpers.createElement("a");
          link.href = ref.url;
          link.className = "leif-material-open-link";
          link.textContent = "Abrir";
          link.target = "_blank";
          link.rel = "noopener";
          row.appendChild(link);
        }
        list.appendChild(row);
      });
      content.appendChild(list);
    } else {
      content.appendChild(
        DomHelpers.createParagraph("Nenhum material vinculado ainda.")
      );
    }
    return content;
  }
  renderMaterialEditor(item, reference) {
    const titleInput = DomHelpers.createInput("text", "T\xEDtulo", reference.title);
    const typeSelect = DomHelpers.createSelect([
      ["pdf", "PDF"],
      ["video", "V\xEDdeo"],
      ["link", "Link"]
    ], reference.type);
    const urlInput = DomHelpers.createInput("url", "URL", reference.url ?? "");
    const row = DomHelpers.createElement("div", "leif-resource-material-editor");
    row.dataset.resourceMaterialEditorId = reference.id;
    row.append(
      this.renderMaterialField("T\xEDtulo", titleInput),
      this.renderMaterialField("Tipo", typeSelect),
      this.renderMaterialField("URL", urlInput)
    );
    const actions = DomHelpers.createElement("div", "leif-resource-material-editor-actions");
    actions.append(
      DomHelpers.createIconButton("save", "Salvar material", {
        dataset: { resourceSaveMaterialId: reference.id },
        onClick: async () => {
          await this.updateMaterialReference(item, reference.id, {
            id: reference.id,
            title: titleInput.value.trim(),
            type: typeSelect.value,
            url: urlInput.value.trim()
          });
        }
      }),
      DomHelpers.createIconButton("delete", "Excluir material", {
        dataset: { resourceDeleteMaterialId: reference.id },
        onClick: async () => {
          await this.deleteMaterialReference(item, reference.id);
        }
      })
    );
    row.appendChild(actions);
    return row;
  }
  renderAddMaterialForm(item) {
    const titleInput = DomHelpers.createInput("text", "T\xEDtulo");
    const typeSelect = DomHelpers.createSelect([
      ["pdf", "PDF"],
      ["video", "V\xEDdeo"],
      ["link", "Link"]
    ]);
    const urlInput = DomHelpers.createInput("url", "URL");
    const form = DomHelpers.createForm(async () => {
      try {
        await this.addStudyItemResourceReferenceUseCase.execute({
          studyItemId: item.id,
          resourceReference: {
            id: createId(`${item.id}-resource`),
            title: titleInput.value,
            type: typeSelect.value,
            url: urlInput.value
          }
        });
        titleInput.value = "";
        urlInput.value = "";
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "N\xE3o consegui adicionar esse link.");
      }
    });
    form.className = "leif-resource-material-form";
    form.append(
      this.renderMaterialField("T\xEDtulo", titleInput),
      this.renderMaterialField("Tipo", typeSelect),
      this.renderMaterialField("URL", urlInput),
      DomHelpers.createElement("div", "leif-form-actions")
    );
    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Salvar material", {
        type: "submit",
        className: "mod-cta"
      })
    );
    return form;
  }
  renderMaterialField(label, control) {
    const field = DomHelpers.createElement("label", "leif-material-field");
    const labelEl = DomHelpers.createElement("span", "leif-material-field-label");
    labelEl.textContent = label;
    field.append(labelEl, control);
    return field;
  }
  async updateMaterialReference(item, referenceId, nextReference) {
    try {
      await this.updateStudyItemUseCase.execute({
        itemId: item.id,
        resourceReferences: (item.resourceReferences ?? []).map(
          (reference) => reference.id === referenceId ? nextReference : reference
        )
      });
      await this.onUpdate();
    } catch (error) {
      DomHelpers.notifyError(error, "N\xE3o consegui salvar esse material.");
    }
  }
  async deleteMaterialReference(item, referenceId) {
    try {
      await this.updateStudyItemUseCase.execute({
        itemId: item.id,
        resourceReferences: (item.resourceReferences ?? []).filter((reference) => reference.id !== referenceId)
      });
      await this.onUpdate();
    } catch (error) {
      DomHelpers.notifyError(error, "N\xE3o consegui excluir esse material.");
    }
  }
  renderCreateItemForm(subjectId) {
    const titleInput = DomHelpers.createInput("text", "T\xEDtulo do item");
    const weightInput = DomHelpers.createInput("number", "Peso", "1");
    const questionCountInput = DomHelpers.createInput("number", "Total de quest\xF5es", "0");
    const totalPagesInput = DomHelpers.createInput("number", "Total de p\xE1ginas (opcional)", "");
    const form = DomHelpers.createForm(async () => {
      try {
        const rawPages = totalPagesInput.value.trim();
        await this.createStudyItemUseCase.execute({
          id: createId(`${subjectId}-item`),
          subjectId,
          title: titleInput.value,
          weight: Number(weightInput.value),
          questionCount: Number(questionCountInput.value),
          totalPages: rawPages === "" ? void 0 : Number(rawPages)
        });
        this.isCreatingItem = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "N\xE3o consegui criar esse recurso.");
      }
    });
    const fields = DomHelpers.createElement("div", "leif-grid leif-grid-2");
    fields.append(
      DomHelpers.createLabel("T\xEDtulo", titleInput),
      DomHelpers.createLabel("Peso", weightInput),
      DomHelpers.createLabel("Quest\xF5es", questionCountInput),
      DomHelpers.createLabel("P\xE1ginas", totalPagesInput)
    );
    form.classList.add("leif-card");
    form.append(
      DomHelpers.createSectionSubtitle("Novo recurso"),
      fields,
      DomHelpers.createElement("div", "leif-form-actions")
    );
    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isCreatingItem = false;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Criar", {
        type: "submit",
        className: "mod-cta"
      })
    );
    return form;
  }
  formatResourceType(type) {
    if (type === "pdf") return "PDF";
    if (type === "video") return "V\xEDdeo";
    return "Link";
  }
};

// src/ui/view/components/SessionsTab.ts
var import_obsidian4 = require("obsidian");

// src/application/use-cases/DeleteStudySessionUseCase.ts
var DeleteStudySessionUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.sessionRepository = repositoryFactory.for("studySessions");
    this.topicRepository = repositoryFactory.for("topics");
  }
  async execute(input) {
    const validation = new DeleteStudySessionValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    const session = await this.sessionRepository.findById(input.sessionId);
    await this.updateTopicQuestionNotebookStats(session);
    await this.sessionRepository.delete(input.sessionId);
    return session;
  }
  async updateTopicQuestionNotebookStats(session) {
    if (session.type !== StudySessionType.QUESTIONS || !session.topicId) {
      return;
    }
    await this.topicRepository.update(session.topicId, (topic) => {
      if (!topic.questionNotebook) {
        return topic;
      }
      return {
        ...topic,
        questionNotebook: {
          ...topic.questionNotebook,
          solvedQuestions: Math.max(0, topic.questionNotebook.solvedQuestions - (session.pagesOrCount ?? 0)),
          correctAnswers: Math.max(0, topic.questionNotebook.correctAnswers - (session.correctAnswers ?? 0))
        }
      };
    });
  }
};

// src/application/use-cases/UpdateStudySessionUseCase.ts
var UpdateStudySessionUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.sessionRepository = repositoryFactory.for("studySessions");
  }
  async execute(input) {
    if (!input.sessionId?.trim()) {
      throw new ValidationError("sessionId is required");
    }
    if (input.pagesOrCount !== void 0 && input.pagesOrCount < 0) {
      throw new ValidationError("pagesOrCount cannot be negative");
    }
    if (input.correctAnswers !== void 0 && input.correctAnswers < 0) {
      throw new ValidationError("correctAnswers cannot be negative");
    }
    return await this.sessionRepository.update(input.sessionId, (session) => {
      const newCount = input.pagesOrCount !== void 0 ? input.pagesOrCount : session.pagesOrCount;
      const newCorrect = input.correctAnswers !== void 0 ? input.correctAnswers : session.correctAnswers;
      if (newCorrect !== void 0 && newCount !== void 0 && newCorrect > newCount) {
        throw new ValidationError("correctAnswers cannot exceed pagesOrCount");
      }
      return {
        ...session,
        pagesOrCount: newCount,
        correctAnswers: newCorrect
      };
    });
  }
};

// src/ui/view/components/SessionsTab.ts
var SessionsTab = class {
  constructor(dataStore, onUpdate) {
    this.dataStore = dataStore;
    this.onUpdate = onUpdate;
    this.editingSessionId = null;
    this.isCreatingSession = false;
    this.pendingDeleteSessionId = null;
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.registerStudySessionUseCase = new RegisterStudySessionUseCase(dataStore, repositoryFactory);
    this.deleteStudySessionUseCase = new DeleteStudySessionUseCase(dataStore, repositoryFactory);
    this.getActiveContestSummaryUseCase = new GetActiveContestSummaryUseCase(dataStore);
    this.listSubjectsForActiveContestUseCase = new ListSubjectsForActiveContestUseCase(dataStore);
    this.updateStudySessionUseCase = new UpdateStudySessionUseCase(dataStore, repositoryFactory);
    this.advanceCycleUseCase = new AdvanceCycleUseCase(dataStore);
    this.getActiveCycleSnapshotUseCase = new GetActiveCycleSnapshotUseCase(dataStore);
  }
  async render(container, data) {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Registros"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Nova sess\xE3o", {
        onClick: async () => {
          this.isCreatingSession = true;
          await this.onUpdate();
        }
      })
    );
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph("Anote o que voc\xEA estudou. O Leif cuida do resto.")
    );
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId) ?? null;
    if (!activeContest) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Sem concurso escolhido",
          "Escolha um concurso antes de registrar estudos."
        )
      );
      return;
    }
    const snapshot = await this.getActiveCycleSnapshotUseCase.execute();
    const itemMap = new Map(data.studyItems.map((item) => [item.id, item.title]));
    const recommendedSubject = snapshot.currentSubject ?? snapshot.nextSubject;
    const afterRecommendedSubject = snapshot.currentSubject && snapshot.nextSubject?.id !== snapshot.currentSubject.id ? snapshot.nextSubject : null;
    const recommendedItemId = snapshot.currentItemId ?? snapshot.nextItemId;
    const cycleContext = DomHelpers.createElement("div", "leif-cycle-context");
    const nowLabel = DomHelpers.createElement("span", "leif-cycle-context-label");
    nowLabel.textContent = "Agora: ";
    const nowValue = DomHelpers.createElement("span", "leif-cycle-context-value");
    nowValue.textContent = recommendedSubject?.name ?? "\u2014";
    cycleContext.appendChild(nowLabel);
    cycleContext.appendChild(nowValue);
    if (recommendedItemId) {
      const itemLabel = DomHelpers.createElement("span", "leif-cycle-context-sublabel");
      itemLabel.textContent = `Item: ${itemMap.get(recommendedItemId) ?? recommendedItemId}`;
      cycleContext.appendChild(itemLabel);
    }
    if (afterRecommendedSubject) {
      const nextInfo = DomHelpers.createElement("span", "leif-cycle-context-next");
      nextInfo.textContent = `Depois vem ${afterRecommendedSubject.name}`;
      cycleContext.appendChild(nextInfo);
    }
    container.appendChild(cycleContext);
    const cycleAction = DomHelpers.createElement("div", "leif-cycle-action");
    cycleAction.appendChild(
      DomHelpers.createButton("Marcar como estudado", {
        className: "mod-cta",
        icon: "refresh-cw",
        onClick: async () => {
          try {
            const result = await this.advanceCycleUseCase.execute();
            new import_obsidian4.Notice(`Pronto. Agora vem ${result.currentSubject?.name ?? "\u2014"}.`);
            await this.onUpdate();
          } catch (error) {
            DomHelpers.notifyError(error, "N\xE3o consegui avan\xE7ar o plano.");
          }
        }
      })
    );
    container.appendChild(cycleAction);
    if (this.isCreatingSession) {
      container.appendChild(this.renderCreateSessionForm(data));
    }
    const subjects = data.subjects.filter((subject) => subject.contestId === activeContest.id);
    const recentSessions = DomHelpers.createCard("Hist\xF3rico recente");
    const sessions = data.studySessions.filter((session) => session.contestId === activeContest.id).slice().reverse().slice(0, 10);
    if (sessions.length === 0) {
      recentSessions.appendChild(DomHelpers.createParagraph("Nenhuma sess\xE3o registrada."));
    } else {
      const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
        "Data",
        "Estudo",
        "Tipo",
        "Resultado"
      ]);
      sessions.forEach((session) => {
        const isEditing = this.editingSessionId === session.id;
        if (isEditing) {
          tbody.appendChild(this.renderEditableRow(session, data));
        } else {
          tbody.appendChild(this.renderDisplayRow(session, data));
        }
      });
      recentSessions.appendChild(tableContainer);
    }
    container.appendChild(recentSessions);
  }
  renderDisplayRow(session, data) {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.sessionId = session.id;
    const subjectName = data.subjects.find((subject) => subject.id === session.subjectId)?.name ?? "\u2014";
    const topicName = data.topics.find((topic) => topic.id === session.topicId)?.name ?? "\u2014";
    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingSessionId = session.id;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("delete", "Excluir", {
        dataset: { sessionDeleteId: session.id },
        onClick: async () => {
          this.pendingDeleteSessionId = session.id;
          await this.onUpdate();
        }
      })
    );
    if (this.pendingDeleteSessionId === session.id) {
      actions.append(
        DomHelpers.createButton("Excluir?", {
          dataset: { sessionConfirmDeleteId: session.id },
          onClick: async () => {
            try {
              await this.deleteStudySessionUseCase.execute({ sessionId: session.id });
              this.pendingDeleteSessionId = null;
              await this.onUpdate();
            } catch (error) {
              DomHelpers.notifyError(error, "N\xE3o consegui excluir esse registro.");
            }
          }
        }),
        DomHelpers.createButton("Cancelar", {
          onClick: async () => {
            this.pendingDeleteSessionId = null;
            await this.onUpdate();
          }
        })
      );
    }
    const dateCell = DomHelpers.createElement("td", "leif-session-date-cell");
    const dateContent = DomHelpers.createElement("div", "leif-topic-title-content");
    const date = DomHelpers.createElement("span");
    date.textContent = new Date(session.studiedAt).toLocaleDateString("pt-BR");
    dateContent.append(date, actions);
    dateCell.appendChild(dateContent);
    tr.appendChild(dateCell);
    tr.appendChild(DomHelpers.createCell(this.formatStudyLabel(subjectName, topicName)));
    tr.appendChild(DomHelpers.createCell(this.formatSessionType(session.type)));
    tr.appendChild(DomHelpers.createCell(null, this.renderSessionResult(session, data)));
    return tr;
  }
  renderSessionProgress(session, data) {
    const container = DomHelpers.createElement("div", "leif-session-progress");
    if (session.type === StudySessionType.PDF && session.studyItemId) {
      const item = data.studyItems.find((i) => i.id === session.studyItemId);
      const total = item?.totalPages;
      const readed = session.pagesOrCount ?? 0;
      if (total !== void 0 && total > 0) {
        const progressBar = DomHelpers.createProgressBar(readed, total);
        container.appendChild(progressBar);
        return container;
      }
    }
    container.textContent = String(session.pagesOrCount ?? 0);
    return container;
  }
  renderEditableRow(session, data) {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-editing-row";
    tr.dataset.sessionId = session.id;
    const countInput = DomHelpers.createCompactInput("number", "Qtd", String(session.pagesOrCount ?? 0));
    const correctInput = DomHelpers.createCompactInput("number", "Acertos", String(session.correctAnswers ?? 0));
    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateStudySessionUseCase.execute({
            sessionId: session.id,
            pagesOrCount: Number(countInput.value),
            correctAnswers: session.type === StudySessionType.QUESTIONS ? Number(correctInput.value) : void 0
          });
          this.editingSessionId = null;
          await this.onUpdate();
        } catch (error) {
          DomHelpers.notifyError(error, "N\xE3o consegui salvar.");
        }
      }
    });
    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingSessionId = null;
        await this.onUpdate();
      }
    });
    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    const subjectName = data.subjects.find((subject) => subject.id === session.subjectId)?.name ?? "\u2014";
    const topicName = data.topics.find((topic) => topic.id === session.topicId)?.name ?? "\u2014";
    const resultFields = DomHelpers.createElement("div", "leif-inline-fields");
    resultFields.append(countInput);
    if (session.type === StudySessionType.QUESTIONS) {
      resultFields.append(correctInput);
    }
    resultFields.append(actions);
    tr.appendChild(DomHelpers.createCell(new Date(session.studiedAt).toLocaleDateString("pt-BR")));
    tr.appendChild(DomHelpers.createCell(this.formatStudyLabel(subjectName, topicName)));
    tr.appendChild(DomHelpers.createCell(this.formatSessionType(session.type)));
    tr.appendChild(DomHelpers.createCell(null, resultFields));
    return tr;
  }
  renderCreateSessionForm(data) {
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);
    if (!activeContest) return DomHelpers.createEmptyState("Sem concurso escolhido", "Escolha um concurso antes de registrar.");
    const subjects = data.subjects.filter((subject) => subject.contestId === activeContest.id);
    const form = DomHelpers.createForm(async () => {
      try {
        const sessionType = typeSelect.value;
        const rawCount = Number(countInput.value);
        const rawCorrect = Number(correctInput.value);
        if (sessionType === StudySessionType.QUESTIONS && (!rawCount || rawCount <= 0)) {
          throw new ValidationError("Informe uma quantidade de quest\xF5es maior que zero.");
        }
        const pagesOrCount = sessionType === StudySessionType.QUESTIONS ? rawCount : rawCount || void 0;
        const correctAnswers = sessionType === StudySessionType.QUESTIONS ? Math.min(rawCorrect, rawCount) : void 0;
        await this.registerStudySessionUseCase.execute({
          id: createId("session"),
          contestId: activeContest.id,
          subjectId: subjectSelect.value,
          studyItemId: itemSelect.value || void 0,
          topicId: topicSelect.value || void 0,
          type: sessionType,
          studiedAt: dateInput.value,
          pagesOrCount,
          correctAnswers,
          completed: true
        });
        this.isCreatingSession = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "N\xE3o consegui salvar esse registro.");
      }
    });
    const subjectSelect = DomHelpers.createSelect(
      subjects.map((subject) => [subject.id, subject.name])
    );
    const typeSelect = DomHelpers.createSelect([
      ["pdf", "PDF"],
      ["video", "V\xEDdeo"],
      [StudySessionType.QUESTIONS, "Quest\xF5es"]
    ]);
    const getItemOptions = () => [
      ["", "Sem item"],
      ...data.studyItems.filter((studyItem) => studyItem.subjectId === subjectSelect.value).map((studyItem) => [studyItem.id, studyItem.title])
    ];
    const getTopicOptions = () => [
      ["", "Sem assunto"],
      ...data.topics.filter((topic) => topic.subjectId === subjectSelect.value).map((topic) => [topic.id, topic.name])
    ];
    const itemSelect = DomHelpers.createSelect(getItemOptions());
    const topicSelect = DomHelpers.createSelect(getTopicOptions());
    const countInput = DomHelpers.createInput("number", "P\xE1ginas ou quantidade", "0");
    const correctInput = DomHelpers.createInput("number", "Acertos", "0");
    const correctLabel = DomHelpers.createLabel("Acertos", correctInput);
    const dateInput = DomHelpers.createInput("date", "Data");
    dateInput.value = this.getDefaultDateValue();
    const syncDependentSelects = () => {
      const previousItem = itemSelect.value;
      const previousTopic = topicSelect.value;
      DomHelpers.replaceSelectOptions(itemSelect, getItemOptions());
      DomHelpers.replaceSelectOptions(topicSelect, getTopicOptions());
      const itemStillValid = Array.from(itemSelect.options).some(
        (option) => option.value === previousItem
      );
      const topicStillValid = Array.from(topicSelect.options).some(
        (option) => option.value === previousTopic
      );
      if (!itemStillValid) {
        itemSelect.value = "";
      }
      if (!topicStillValid) {
        topicSelect.value = "";
      }
    };
    const syncQuestionField = () => {
      const isQuestionSession = typeSelect.value === StudySessionType.QUESTIONS;
      correctLabel.style.display = isQuestionSession ? "" : "none";
    };
    subjectSelect.addEventListener("change", syncDependentSelects);
    typeSelect.addEventListener("change", syncQuestionField);
    syncDependentSelects();
    syncQuestionField();
    const formGrid = DomHelpers.createElement("div", "leif-grid leif-grid-2");
    formGrid.append(
      DomHelpers.createLabel("Mat\xE9ria", subjectSelect),
      DomHelpers.createLabel("Tipo", typeSelect),
      DomHelpers.createLabel("Item", itemSelect),
      DomHelpers.createLabel("Assunto", topicSelect),
      DomHelpers.createLabel("Quantidade", countInput),
      correctLabel,
      DomHelpers.createLabel("Data", dateInput)
    );
    form.classList.add("leif-card");
    form.append(
      DomHelpers.createSectionSubtitle("Novo registro"),
      formGrid,
      DomHelpers.createElement("div", "leif-form-actions")
    );
    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isCreatingSession = false;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Registrar", {
        type: "submit",
        className: "mod-cta"
      })
    );
    return form;
  }
  formatSessionType(type) {
    if (type === StudySessionType.QUESTIONS) return "Quest\xF5es";
    if (type === StudySessionType.VIDEO) return "V\xEDdeo";
    return "PDF";
  }
  formatStudyLabel(subjectName, topicName) {
    return topicName === "\u2014" ? subjectName : `${subjectName} \xB7 ${topicName}`;
  }
  renderSessionResult(session, data) {
    if (session.type === StudySessionType.QUESTIONS) {
      const result = DomHelpers.createElement("span");
      result.textContent = `${session.correctAnswers ?? 0}/${session.pagesOrCount ?? 0} acertos`;
      return result;
    }
    return this.renderSessionProgress(session, data);
  }
  getDefaultDateValue() {
    const now = /* @__PURE__ */ new Date();
    const timezoneOffset = now.getTimezoneOffset() * 6e4;
    const localDate = new Date(now.getTime() - timezoneOffset);
    return localDate.toISOString().split("T")[0];
  }
};

// src/application/use-cases/DeleteTopicUseCase.ts
var DeleteTopicUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.topicRepository = repositoryFactory.for("topics");
    this.subjectRepository = repositoryFactory.for("subjects");
  }
  async execute(input) {
    const topic = await this.topicRepository.findById(input.topicId);
    await this.topicRepository.delete(input.topicId);
    await this.subjectRepository.update(topic.subjectId, (subject) => ({
      ...subject,
      topicIds: subject.topicIds.filter((id) => id !== input.topicId)
    }));
    return topic;
  }
};

// src/domain/entities/QuestionNotebook.ts
var QuestionNotebook = class {
  constructor(id, name, url, solvedQuestions = 0, correctAnswers = 0, notes) {
    this.id = id;
    this.name = name;
    this.url = url;
    this.solvedQuestions = solvedQuestions;
    this.correctAnswers = correctAnswers;
    this.notes = notes;
    if (!id?.trim()) throw new ValidationError("QuestionNotebook ID is required");
    if (!name?.trim()) throw new ValidationError("QuestionNotebook name is required");
    if (!url?.trim()) throw new ValidationError("QuestionNotebook URL is required");
    if (solvedQuestions < 0) throw new ValidationError("Solved questions cannot be negative");
    if (correctAnswers < 0) throw new ValidationError("Correct answers cannot be negative");
    if (correctAnswers > solvedQuestions) throw new ValidationError("Correct answers cannot exceed solved questions");
  }
};

// src/application/use-cases/UpdateTopicUseCase.ts
var UpdateTopicUseCase = class {
  constructor(dataStore, repositoryFactory) {
    this.dataStore = dataStore;
    this.topicRepository = repositoryFactory.for("topics");
  }
  async execute(input) {
    if (!input.topicId?.trim()) {
      throw new ValidationError("topicId is required");
    }
    if (input.name !== void 0 && !input.name.trim()) {
      throw new ValidationError("name cannot be empty");
    }
    return await this.topicRepository.update(input.topicId, (topic) => {
      let notebook = topic.questionNotebook;
      if (input.questionNotebook) {
        const solved = input.questionNotebook.solvedQuestions ?? notebook?.solvedQuestions ?? 0;
        const correct = input.questionNotebook.correctAnswers ?? notebook?.correctAnswers ?? 0;
        if (correct > solved) {
          throw new ValidationError("correctAnswers cannot exceed solvedQuestions");
        }
        notebook = new QuestionNotebook(
          input.questionNotebook.id,
          input.questionNotebook.name,
          input.questionNotebook.url,
          solved,
          correct,
          notebook?.notes
        );
      }
      return {
        ...topic,
        name: input.name ?? topic.name,
        questionNotebook: notebook
      };
    });
  }
};

// src/ui/view/components/TopicsTab.ts
var TopicsTab = class {
  constructor(dataStore, onUpdate) {
    this.dataStore = dataStore;
    this.onUpdate = onUpdate;
    this.selectedSubjectId = null;
    this.editingTopicId = null;
    this.expandedTopicId = null;
    this.isCreatingTopic = false;
    this.pendingDeleteTopicId = null;
    const repositoryFactory = new EntityRepositoryFactory(dataStore);
    this.createTopicUseCase = new CreateTopicUseCase(dataStore, repositoryFactory);
    this.deleteTopicUseCase = new DeleteTopicUseCase(dataStore, repositoryFactory);
    this.linkQuestionNotebookUseCase = new LinkQuestionNotebookUseCase(dataStore, repositoryFactory);
    this.updateTopicUseCase = new UpdateTopicUseCase(dataStore, repositoryFactory);
  }
  async render(container, data) {
    const header = DomHelpers.createElement("div", "leif-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Edital"));
    header.appendChild(
      DomHelpers.createIconButton("add", "Novo assunto", {
        onClick: async () => {
          this.isCreatingTopic = true;
          await this.onUpdate();
        }
      })
    );
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph(
        "Transforme o edital em assuntos pequenos e conecte cadernos de quest\xF5es quando fizer sentido."
      )
    );
    const subject = SubjectPicker.getSelectedSubject(data, this.selectedSubjectId);
    if (!subject) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Sem mat\xE9ria escolhida",
          "Crie uma mat\xE9ria no Plano para organizar o edital."
        )
      );
      return;
    }
    container.appendChild(
      SubjectPicker.create(data, this.selectedSubjectId, async (subjectId) => {
        this.selectedSubjectId = subjectId;
        await this.onUpdate();
      })
    );
    if (this.isCreatingTopic) {
      container.appendChild(this.renderCreateTopicForm(subject.id));
    }
    const topics = data.topics.filter((topic) => topic.subjectId === subject.id);
    const card = DomHelpers.createCard(`Assuntos de ${subject.name}`);
    if (topics.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Nenhum assunto cadastrado nessa mat\xE9ria."));
      container.appendChild(card);
      return;
    }
    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Assunto",
      "Quest\xF5es",
      "Caderno"
    ]);
    topics.forEach((topic) => {
      const isEditing = this.editingTopicId === topic.id;
      const isExpanded = this.expandedTopicId === topic.id;
      if (isEditing) {
        tbody.appendChild(this.renderEditableRow(topic, data));
      } else {
        tbody.appendChild(this.renderDisplayRow(topic, data));
      }
      if (isExpanded && !isEditing) {
        tbody.appendChild(this.renderDetailRow(topic, data));
      }
    });
    card.appendChild(tableContainer);
    container.appendChild(card);
  }
  renderDisplayRow(topic, data) {
    const tr = DomHelpers.createElement("tr");
    tr.dataset.topicId = topic.id;
    const hasDetails = Boolean(topic.questionNotebook);
    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(
      DomHelpers.createIconButton(
        this.expandedTopicId === topic.id ? "collapse" : "expand",
        this.expandedTopicId === topic.id ? "Recolher" : "Expandir",
        {
          className: `clickable-icon ${hasDetails ? "" : "leif-expand-button"}`,
          onClick: async () => {
            this.expandedTopicId = this.expandedTopicId === topic.id ? null : topic.id;
            await this.onUpdate();
          }
        }
      )
    );
    actions.appendChild(
      DomHelpers.createIconButton("edit", "Editar", {
        onClick: async () => {
          this.editingTopicId = topic.id;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("delete", "Excluir", {
        onClick: async () => {
          this.pendingDeleteTopicId = topic.id;
          await this.onUpdate();
        }
      })
    );
    if (this.pendingDeleteTopicId === topic.id) {
      actions.append(
        DomHelpers.createButton("Excluir?", {
          onClick: async () => {
            try {
              await this.deleteTopicUseCase.execute({ topicId: topic.id });
              this.pendingDeleteTopicId = null;
              await this.onUpdate();
            } catch (error) {
              DomHelpers.notifyError(error, "N\xE3o consegui excluir esse assunto.");
            }
          }
        }),
        DomHelpers.createButton("Cancelar", {
          onClick: async () => {
            this.pendingDeleteTopicId = null;
            await this.onUpdate();
          }
        })
      );
    }
    const titleCell = DomHelpers.createElement("td", "leif-topic-title-cell");
    const titleContent = DomHelpers.createElement("div", "leif-topic-title-content");
    const title = DomHelpers.createElement("span", "leif-topic-title");
    title.textContent = topic.name;
    titleContent.append(title, actions);
    titleCell.appendChild(titleContent);
    tr.appendChild(titleCell);
    tr.appendChild(DomHelpers.createCell(this.formatQuestionProgress(topic)));
    tr.appendChild(DomHelpers.createCell(null, this.renderNotebookCell(topic)));
    return tr;
  }
  renderNotebookCell(topic) {
    const notebook = topic.questionNotebook;
    if (!notebook) {
      return DomHelpers.createParagraph("\u2014");
    }
    if (!notebook.url) {
      return DomHelpers.createParagraph(notebook.name);
    }
    const link = DomHelpers.createElement("a");
    link.href = notebook.url;
    link.textContent = notebook.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.dataset.topicNotebookUrl = topic.id;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.open(notebook.url, "_blank", "noopener");
    });
    return link;
  }
  renderEditableRow(topic, data) {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-editing-row";
    tr.dataset.topicId = topic.id;
    const nameInput = DomHelpers.createCompactInput("text", "Nome", topic.name);
    const solvedInput = DomHelpers.createCompactInput(
      "number",
      "Resolv.",
      String(topic.questionNotebook?.solvedQuestions ?? 0)
    );
    const correctInput = DomHelpers.createCompactInput(
      "number",
      "Acert.",
      String(topic.questionNotebook?.correctAnswers ?? 0)
    );
    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateTopicUseCase.execute({
            topicId: topic.id,
            name: nameInput.value,
            questionNotebook: topic.questionNotebook ? {
              id: topic.questionNotebook.id,
              name: topic.questionNotebook.name,
              url: topic.questionNotebook.url,
              solvedQuestions: Number(solvedInput.value),
              correctAnswers: Number(correctInput.value)
            } : void 0
          });
          this.editingTopicId = null;
          await this.onUpdate();
        } catch (error) {
          DomHelpers.notifyError(error, "N\xE3o consegui salvar.");
        }
      }
    });
    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingTopicId = null;
        await this.onUpdate();
      }
    });
    const actions = DomHelpers.createElement("div", "leif-inline-actions leif-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    const titleCell = DomHelpers.createElement("td", "leif-topic-title-cell");
    const titleContent = DomHelpers.createElement("div", "leif-topic-title-content");
    titleContent.append(nameInput, actions);
    titleCell.appendChild(titleContent);
    tr.appendChild(titleCell);
    const questionCell = DomHelpers.createElement("td");
    const questionFields = DomHelpers.createElement("div", "leif-inline-fields");
    questionFields.append(solvedInput, correctInput);
    questionCell.appendChild(questionFields);
    tr.appendChild(questionCell);
    tr.appendChild(DomHelpers.createCell(null, DomHelpers.createParagraph(topic.questionNotebook?.name ?? "Sem caderno")));
    return tr;
  }
  renderDetailRow(topic, data) {
    const tr = DomHelpers.createElement("tr");
    tr.className = "leif-detail-row";
    const td = DomHelpers.createElement("td");
    td.colSpan = 3;
    const content = DomHelpers.createElement("div", "leif-detail-content");
    const notebookName = DomHelpers.createInput("text", "Caderno", topic.questionNotebook?.name ?? "");
    const notebookUrl = DomHelpers.createInput("url", "URL", topic.questionNotebook?.url ?? "");
    const notebookSolved = DomHelpers.createInput(
      "number",
      "Resolv.",
      String(topic.questionNotebook?.solvedQuestions ?? 0)
    );
    const notebookCorrect = DomHelpers.createInput(
      "number",
      "Acert.",
      String(topic.questionNotebook?.correctAnswers ?? 0)
    );
    const notebookForm = DomHelpers.createForm(async () => {
      try {
        await this.linkQuestionNotebookUseCase.execute({
          topicId: topic.id,
          questionNotebook: {
            id: topic.questionNotebook?.id ?? `${topic.id}-notebook`,
            name: notebookName.value,
            url: notebookUrl.value,
            solvedQuestions: Number(notebookSolved.value),
            correctAnswers: Number(notebookCorrect.value)
          }
        });
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "N\xE3o consegui salvar esse caderno.");
      }
    });
    notebookForm.className = "leif-detail-form";
    notebookForm.dataset.topicNotebookForm = topic.id;
    notebookForm.append(
      DomHelpers.createLabel("Caderno", notebookName),
      DomHelpers.createLabel("URL", notebookUrl),
      DomHelpers.createLabel("Resolv.", notebookSolved),
      DomHelpers.createLabel("Acert.", notebookCorrect),
      DomHelpers.createIconButton("save", "Salvar", { onClick: () => notebookForm.requestSubmit() })
    );
    content.appendChild(notebookForm);
    td.appendChild(content);
    tr.appendChild(td);
    return tr;
  }
  renderCreateTopicForm(subjectId) {
    const nameInput = DomHelpers.createInput("text", "Nome do assunto");
    const form = DomHelpers.createForm(async () => {
      try {
        await this.createTopicUseCase.execute({
          id: createId(`${subjectId}-topic`),
          subjectId,
          name: nameInput.value
        });
        this.isCreatingTopic = false;
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "N\xE3o consegui criar esse assunto.");
      }
    });
    form.classList.add("leif-card");
    form.append(
      DomHelpers.createSectionSubtitle("Novo assunto"),
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createElement("div", "leif-form-actions")
    );
    const actions = form.querySelector(".leif-form-actions");
    actions?.append(
      DomHelpers.createButton("Cancelar", {
        onClick: async () => {
          this.isCreatingTopic = false;
          await this.onUpdate();
        }
      }),
      DomHelpers.createButton("Criar", {
        type: "submit",
        className: "mod-cta"
      })
    );
    return form;
  }
  formatQuestionProgress(topic) {
    const solved = topic.questionNotebook?.solvedQuestions ?? 0;
    const correct = topic.questionNotebook?.correctAnswers ?? 0;
    if (solved === 0) {
      return "0 resolvidas";
    }
    return `${correct}/${solved} acertos`;
  }
};

// src/ui/view/components/WallTab.ts
var WallTab = class {
  constructor(dataStore, onUpdate) {
    this.dataStore = dataStore;
    this.onUpdate = onUpdate;
    this.updateContestWallUseCase = new UpdateContestWallUseCase(dataStore, new EntityRepositoryFactory(dataStore));
  }
  async render(container, data) {
    container.appendChild(DomHelpers.createSectionTitle("Mural"));
    container.appendChild(
      DomHelpers.createParagraph("Guarde links oficiais e anota\xE7\xF5es \xFAteis do concurso ativo.")
    );
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId) ?? null;
    if (!activeContest) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Sem concurso escolhido",
          "Escolha um concurso para guardar links e notas."
        )
      );
      return;
    }
    container.appendChild(this.renderWallForm(activeContest));
    container.appendChild(this.renderSnapshotsCard(activeContest, data));
  }
  renderWallForm(activeContest) {
    const noticeLabel = DomHelpers.createInput(
      "text",
      "R\xF3tulo do edital",
      activeContest.wall.noticeLinks[0]?.label ?? ""
    );
    const noticeUrl = DomHelpers.createInput(
      "url",
      "URL do edital",
      activeContest.wall.noticeLinks[0]?.url ?? ""
    );
    const examLabel = DomHelpers.createInput(
      "text",
      "R\xF3tulo da prova",
      activeContest.wall.examLinks[0]?.label ?? ""
    );
    const examUrl = DomHelpers.createInput(
      "url",
      "URL da prova",
      activeContest.wall.examLinks[0]?.url ?? ""
    );
    const notes = DomHelpers.createTextarea(
      "Notas do concurso",
      activeContest.wall.notes ?? ""
    );
    notes.rows = 8;
    notes.classList.add("leif-wall-notes");
    const form = DomHelpers.createForm(async () => {
      try {
        const noticeLink = noticeUrl.value ? [
          {
            id: wallLinkKey(activeContest.id, "notice"),
            label: noticeLabel.value || "Edital",
            url: noticeUrl.value
          }
        ] : [];
        const examLink = examUrl.value ? [
          {
            id: wallLinkKey(activeContest.id, "exam"),
            label: examLabel.value || "Prova",
            url: examUrl.value
          }
        ] : [];
        await this.updateContestWallUseCase.execute({
          contestId: activeContest.id,
          wall: {
            noticeLinks: noticeLink,
            examLinks: examLink,
            subjectSnapshots: activeContest.wall.subjectSnapshots,
            notes: notes.value
          }
        });
        await this.onUpdate();
      } catch (error) {
        DomHelpers.notifyError(error, "N\xE3o consegui salvar o mural.");
      }
    });
    form.classList.add("leif-wall-form");
    const notesCard = DomHelpers.createElement("section", "leif-wall-card leif-wall-primary");
    notesCard.append(
      DomHelpers.createSectionSubtitle("Notas"),
      DomHelpers.createParagraph("Use este espa\xE7o para pesos, datas, cortes, estrat\xE9gia e qualquer lembrete que voc\xEA queira revisar sem procurar em outro lugar."),
      DomHelpers.createStackedLabel("Notas", notes)
    );
    const noticeCard = DomHelpers.createElement("section", "leif-wall-card");
    noticeCard.append(
      DomHelpers.createSectionSubtitle("Edital"),
      DomHelpers.createParagraph("Guarde o link do edital ou da p\xE1gina oficial do concurso."),
      DomHelpers.createLabel("Nome", noticeLabel),
      DomHelpers.createLabel("Link", noticeUrl)
    );
    const examCard = DomHelpers.createElement("section", "leif-wall-card");
    examCard.append(
      DomHelpers.createSectionSubtitle("Prova"),
      DomHelpers.createParagraph("Deixe aqui a prova anterior, o espelho ou outro material de refer\xEAncia."),
      DomHelpers.createLabel("Nome", examLabel),
      DomHelpers.createLabel("Link", examUrl)
    );
    const referenceGrid = DomHelpers.createElement("div", "leif-wall-reference-grid");
    referenceGrid.append(noticeCard, examCard);
    form.append(notesCard, referenceGrid);
    form.append(
      DomHelpers.createButton("Salvar mural", {
        type: "submit",
        className: "mod-cta leif-wall-save"
      })
    );
    return form;
  }
  renderSnapshotsCard(activeContest, data) {
    const card = DomHelpers.createCard("Resumo das mat\xE9rias");
    if (activeContest.wall.subjectSnapshots.length === 0) {
      card.appendChild(
        DomHelpers.createParagraph("Ainda n\xE3o h\xE1 resumo salvo para as mat\xE9rias.")
      );
    } else {
      const subjectMap = new Map(data.subjects.map((s) => [s.id, s.name]));
      const itemMap = new Map(data.studyItems.map((item) => [item.id, item.title]));
      card.appendChild(
        DomHelpers.createTable(
          ["Mat\xE9ria", "Peso", "Pontua\xE7\xE3o", "Itens alvo"],
          activeContest.wall.subjectSnapshots.map((snapshot) => [
            subjectMap.get(snapshot.subjectId) ?? snapshot.subjectId,
            snapshot.weight !== void 0 ? String(snapshot.weight) : "\u2014",
            snapshot.score !== void 0 ? String(snapshot.score) : "\u2014",
            snapshot.targetItems?.map((itemId) => itemMap.get(itemId) ?? itemId).join(", ") ?? "\u2014"
          ])
        )
      );
    }
    return card;
  }
};

// src/ui/view/LeifView.ts
var LeifView = class extends import_obsidian5.ItemView {
  constructor(leaf, dataStore) {
    super(leaf);
    this.dataStore = dataStore;
    this.activeTab = "dashboard";
    this.selectedSubjectId = null;
    this.tabButtons = /* @__PURE__ */ new Map();
    this.dashboardTab = new DashboardTab(dataStore, () => this.refresh());
    this.contestsTab = new ContestsTab(dataStore, () => this.refresh());
    this.cycleTab = new CycleTab(dataStore, () => this.refresh());
    this.itemsTab = new ItemsTab(dataStore, () => this.refresh());
    this.topicsTab = new TopicsTab(dataStore, () => this.refresh());
    this.sessionsTab = new SessionsTab(dataStore, () => this.refresh());
    this.wallTab = new WallTab(dataStore, () => this.refresh());
  }
  getViewType() {
    return LEIF_VIEW_TYPE;
  }
  getDisplayText() {
    return "Leif";
  }
  getIcon() {
    return LEIF_ICON;
  }
  async onOpen() {
    await this.render();
  }
  /**
   * Full render - builds the shell structure once, then updates dynamic content.
   */
  async render() {
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
  async refresh() {
    const data = await this.dataStore.load();
    this.ensureSelectedSubject(data);
    await this.updateHeader(data);
    await this.updateActiveTab(data);
  }
  /**
   * Builds the shell structure once.
   */
  buildShell() {
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
    this.tabBar.setAttribute("aria-label", "Se\xE7\xF5es do Leif");
    TABS.forEach((tab, index) => {
      const button = DomHelpers.createButton(tab.label, {
        dataset: { tab: tab.id },
        className: "leif-tab-button",
        onClick: async () => {
          await this.selectTab(tab.id);
        }
      });
      button.setAttribute("role", "tab");
      button.id = `leif-tab-${tab.id}`;
      button.tabIndex = tab.id === this.activeTab ? 0 : -1;
      button.setAttribute("aria-selected", String(tab.id === this.activeTab));
      button.setAttribute("aria-controls", "leif-tabpanel");
      button.addEventListener("keydown", (event) => {
        this.handleTabKeyDown(event, index);
      });
      this.tabButtons.set(tab.id, button);
      this.tabBar.appendChild(button);
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
  async updateHeader(data) {
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
  async updateActiveTab(data) {
    if (!this.activeTabContainer) return;
    this.updateTabButtonStyles();
    this.activeTabContainer.innerHTML = "";
    await this.renderActiveTab(this.activeTabContainer, data);
  }
  /**
   * Selects a tab, updating aria state and re-rendering.
   */
  async selectTab(tabId) {
    this.activeTab = tabId;
    this.updateTabButtonStyles();
    await this.refresh();
  }
  /**
   * Moves focus between tabs with Arrow keys and activates on Enter/Space.
   */
  handleTabKeyDown(event, index) {
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
  updateTabButtonStyles() {
    this.tabButtons.forEach((button, tabId) => {
      const isActive = this.activeTab === tabId;
      button.className = isActive ? "leif-tab-button is-active" : "leif-tab-button";
      button.tabIndex = isActive ? 0 : -1;
      button.setAttribute("aria-selected", String(isActive));
    });
    this.activeTabContainer?.setAttribute("aria-labelledby", `leif-tab-${this.activeTab}`);
  }
  async renderActiveTab(container, data) {
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
  ensureSelectedSubject(data) {
    const selectedSubject = SubjectPicker.getSelectedSubject(data, this.selectedSubjectId);
    this.selectedSubjectId = selectedSubject?.id ?? null;
  }
};

// src/ui/view/registerLeifView.ts
var LEIF_VIEW_TYPE = "leif-main-view";
var LEIF_ICON = "feather";
function registerLeifView(plugin, dataStore) {
  plugin.registerView(LEIF_VIEW_TYPE, (leaf) => new LeifView(leaf, dataStore));
  plugin.addRibbonIcon(LEIF_ICON, "Abrir Leif", () => openLeifView(plugin));
  plugin.addCommand({
    id: "leif-open-view",
    name: t("command.openView"),
    callback: async () => {
      await openLeifView(plugin);
    }
  });
}
async function openLeifView(plugin) {
  const existingLeaf = plugin.app.workspace.getLeavesOfType(LEIF_VIEW_TYPE)[0];
  const leaf = existingLeaf ?? plugin.app.workspace.getLeaf();
  await leaf.setViewState({
    type: LEIF_VIEW_TYPE,
    active: true
  });
  await plugin.app.workspace.revealLeaf(leaf);
}

// src/main.ts
var LeifPlugin = class extends import_obsidian6.Plugin {
  async onload() {
    this.dataStore = new PluginDataStore(new ObsidianStorageAdapter(this));
    await this.dataStore.load();
    registerLeifView(this, this.dataStore);
    registerCommands(this, this.dataStore);
  }
};
