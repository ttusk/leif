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
  default: () => CorvoPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian12 = require("obsidian");

// src/domain/types/CorvoPluginData.ts
function createDefaultCorvoPluginData() {
  return {
    version: 1,
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
    topics: deduplicateByKey(data.topics, (t) => t.id),
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
      return createDefaultCorvoPluginData();
    }
    const migratedData = this.migrationService.migrate(storedData);
    return {
      ...createDefaultCorvoPluginData(),
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
var import_obsidian = require("obsidian");

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
   * @returns The next item ID, or null if no items exist
   */
  getNextItemId(subject, currentItemId) {
    if (subject.itemIds.length === 0) {
      return null;
    }
    if (!currentItemId) {
      return subject.itemIds[0];
    }
    const currentIndex = subject.itemIds.findIndex((itemId) => itemId === currentItemId);
    if (currentIndex === -1) {
      return subject.itemIds[0];
    }
    return subject.itemIds[(currentIndex + 1) % subject.itemIds.length];
  }
};

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
  constructor(dataStore, cycleService = new CycleService()) {
    this.dataStore = dataStore;
    this.cycleService = cycleService;
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
      throw new Error(`Contest "${activeContestId}" has no active subjects.`);
    }
    const nextState = {
      contestId: currentState.contestId,
      currentSubjectId: nextSubject.id,
      currentItemId: this.cycleService.getNextItemId(nextSubject)
    };
    await this.dataStore.save({
      ...data,
      contestStates: data.contestStates.map(
        (state) => state.contestId === nextState.contestId ? nextState : state
      )
    });
    return nextState;
  }
};

// src/domain/entities/Contest.ts
var Contest = class {
  constructor(id, name, subjectIds = [], wall = { noticeLinks: [], examLinks: [], subjectSnapshots: [] }) {
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
    const entities = data[this.entityKey];
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
    return data[this.entityKey];
  }
  /**
   * Checks if an entity exists by ID.
   * 
   * @param id - The entity ID
   * @returns True if the entity exists, false otherwise
   */
  async exists(id) {
    const data = await this.dataStore.load();
    const entities = data[this.entityKey];
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
    const entities = data[this.entityKey];
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
    const entities = data[this.entityKey];
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
    const entities = data[this.entityKey];
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
    data[this.entityKey] = entities;
    await this.dataStore.save(data);
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
      requireNonEmpty(input.id, "ID"),
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
      requireNonEmpty(input.name, "Name"),
      requireNonNegative(input.order, "Order")
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
      requireNonEmpty(input.resourceReference.type, "Resource reference type")
    );
  }
};
var AddTopicResourceReferenceValidator = class {
  validate(input) {
    return collectErrors(
      requireNonEmpty(input.topicId, "Topic ID"),
      requireNonEmpty(input.resourceReference.id, "Resource reference ID"),
      requireNonEmpty(input.resourceReference.title, "Resource reference title"),
      requireNonEmpty(input.resourceReference.type, "Resource reference type")
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
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.contestRepository = new EntityRepository(dataStore, "contests");
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
  constructor(id, subjectId, title, order, weight, questionCount, resourceReferences) {
    this.id = id;
    this.subjectId = subjectId;
    this.title = title;
    this.order = order;
    this.weight = weight;
    this.questionCount = questionCount;
    this.resourceReferences = resourceReferences;
    if (!id?.trim()) throw new ValidationError("StudyItem ID is required");
    if (!subjectId?.trim()) throw new ValidationError("StudyItem subjectId is required");
    if (!title?.trim()) throw new ValidationError("StudyItem title is required");
    if (order < 0) throw new ValidationError("StudyItem order cannot be negative");
    if (weight !== void 0 && weight < 0) throw new ValidationError("StudyItem weight cannot be negative");
    if (questionCount !== void 0 && questionCount < 0) throw new ValidationError("StudyItem questionCount cannot be negative");
  }
};

// src/application/use-cases/CreateStudyItemUseCase.ts
var CreateStudyItemUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.subjectRepository = new EntityRepository(dataStore, "subjects");
    this.studyItemRepository = new EntityRepository(dataStore, "studyItems");
  }
  async execute(input) {
    const validation = new CreateStudyItemValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    const subject = await this.subjectRepository.findById(input.subjectId);
    const subjectItems = (await this.studyItemRepository.findAll()).filter((item) => item.subjectId === input.subjectId);
    const nextItem = new StudyItem(
      input.id,
      input.subjectId,
      input.title,
      subjectItems.length + 1,
      input.weight,
      input.questionCount,
      input.resourceReferences ?? []
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
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.contestRepository = new EntityRepository(dataStore, "contests");
    this.subjectRepository = new EntityRepository(dataStore, "subjects");
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
  constructor(id, subjectId, name, order, resourceReferences = [], questionNotebook) {
    this.id = id;
    this.subjectId = subjectId;
    this.name = name;
    this.order = order;
    this.resourceReferences = resourceReferences;
    this.questionNotebook = questionNotebook;
    if (!id?.trim()) throw new ValidationError("Topic ID is required");
    if (!subjectId?.trim()) throw new ValidationError("Topic subjectId is required");
    if (!name?.trim()) throw new ValidationError("Topic name is required");
    if (order < 0) throw new ValidationError("Topic order cannot be negative");
  }
};

// src/application/use-cases/CreateTopicUseCase.ts
var CreateTopicUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.topicRepository = new EntityRepository(dataStore, "topics");
    this.subjectRepository = new EntityRepository(dataStore, "subjects");
  }
  async execute(input) {
    const validation = new CreateTopicValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    const subject = await this.subjectRepository.findById(input.subjectId);
    const subjectTopics = (await this.topicRepository.findAll()).filter((topic2) => topic2.subjectId === input.subjectId);
    const topic = new Topic(
      input.id,
      input.subjectId,
      input.name,
      input.order ?? subjectTopics.length + 1,
      []
    );
    await this.topicRepository.create(topic);
    await this.subjectRepository.update(input.subjectId, (subject2) => ({
      ...subject2,
      topicIds: [...subject2.topicIds, topic.id]
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
      const pdfProgressCount = subjectSessions.filter((session) => session.type === "pdf").reduce((total, session) => total + (session.pagesOrCount ?? 0), 0);
      const questionSessions = subjectSessions.filter((session) => session.type === "questions");
      const questionProgressCount = questionSessions.reduce(
        (total, session) => total + (session.pagesOrCount ?? 0),
        0
      );
      const totalCorrectAnswers = questionSessions.reduce(
        (total, session) => total + (session.correctAnswers ?? 0),
        0
      );
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        totalSessions: subjectSessions.length,
        pdfProgressCount,
        questionProgressCount,
        questionAccuracy: questionProgressCount > 0 ? totalCorrectAnswers / questionProgressCount : null
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
  constructor(dataStore, cycleService = new CycleService()) {
    this.dataStore = dataStore;
    this.cycleService = cycleService;
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
    return {
      contestId: activeContestId,
      currentSubject,
      nextSubject,
      currentItemId: currentState.currentItemId,
      nextItemId: currentSubject ? this.cycleService.getNextItemId(currentSubject, currentState.currentItemId ?? void 0) : null
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
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.contestRepository = new EntityRepository(dataStore, "contests");
    this.subjectRepository = new EntityRepository(dataStore, "subjects");
  }
  async execute(input) {
    const validation = new ReorderSubjectsValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    const contest = await this.contestRepository.findById(input.contestId);
    const contestSubjects = (await this.subjectRepository.findAll()).filter((subject) => subject.contestId === input.contestId);
    if (contestSubjects.length !== input.subjectIdsInOrder.length) {
      throw new Error("The provided subject order does not match the contest subject list.");
    }
    const subjectIdSet = new Set(contestSubjects.map((subject) => subject.id));
    for (const subjectId of input.subjectIdsInOrder) {
      if (!subjectIdSet.has(subjectId)) {
        throw new Error(`Subject "${subjectId}" does not belong to contest "${input.contestId}".`);
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
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.contestRepository = new EntityRepository(dataStore, "contests");
    this.subjectRepository = new EntityRepository(dataStore, "subjects");
    this.topicRepository = new EntityRepository(dataStore, "topics");
    this.sessionRepository = new EntityRepository(dataStore, "studySessions");
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
    await this.sessionRepository.create(input);
    await this.updateTopicQuestionNotebookStats(input);
    return input;
  }
  async updateTopicQuestionNotebookStats(session) {
    if (session.type !== "questions" || !session.topicId) {
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
          solvedQuestions: topic.questionNotebook.solvedQuestions + (session.pagesOrCount ?? 0),
          correctAnswers: topic.questionNotebook.correctAnswers + (session.correctAnswers ?? 0)
        }
      };
    });
  }
};

// src/application/use-cases/SetSubjectActiveStateUseCase.ts
var SetSubjectActiveStateUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.subjectRepository = new EntityRepository(dataStore, "subjects");
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
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.contestRepository = new EntityRepository(dataStore, "contests");
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
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.contestRepository = new EntityRepository(dataStore, "contests");
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
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.subjectRepository = new EntityRepository(dataStore, "subjects");
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

// src/ui/commands/registerCommands.ts
function registerCommands(plugin, dataStore) {
  const createContest = new CreateContestUseCase(dataStore);
  const createSubject = new CreateSubjectUseCase(dataStore);
  const createStudyItem = new CreateStudyItemUseCase(dataStore);
  const createTopic = new CreateTopicUseCase(dataStore);
  const updateContestWall = new UpdateContestWallUseCase(dataStore);
  const registerStudySession = new RegisterStudySessionUseCase(dataStore);
  const setActiveContest = new SetActiveContestUseCase(dataStore);
  const advanceCycle = new AdvanceCycleUseCase(dataStore);
  const getActiveCycleSnapshot = new GetActiveCycleSnapshotUseCase(dataStore);
  const getActiveContestSummary = new GetActiveContestSummaryUseCase(dataStore);
  const listSubjectsForActiveContest = new ListSubjectsForActiveContestUseCase(dataStore);
  const reorderSubjects = new ReorderSubjectsUseCase(dataStore);
  const setSubjectActiveState = new SetSubjectActiveStateUseCase(dataStore);
  const updateSubjectConfiguration = new UpdateSubjectConfigurationUseCase(dataStore);
  plugin.addCommand({
    id: "corvo-show-active-contest",
    name: "Show active contest",
    callback: async () => {
      const data = await dataStore.load();
      const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);
      new import_obsidian.Notice(activeContest ? `Active contest: ${activeContest.name}` : "No active contest configured.");
    }
  });
  plugin.addCommand({
    id: "corvo-seed-demo-data",
    name: "Seed demo data",
    callback: async () => {
      const data = await dataStore.load();
      if (data.contests.length > 0) {
        new import_obsidian.Notice("Corvo already has data. Demo seed skipped.");
        return;
      }
      await createContest.execute({ id: "demo-trt", name: "TRT Demo" });
      await createContest.execute({ id: "demo-sefaz", name: "SEFAZ Demo" });
      await createSubject.execute({
        id: "subject-portuguese",
        contestId: "demo-trt",
        name: "Portuguese",
        plannedStudyMinutes: 60
      });
      await createSubject.execute({
        id: "subject-constitutional-law",
        contestId: "demo-trt",
        name: "Constitutional Law",
        plannedStudyMinutes: 45
      });
      await createSubject.execute({
        id: "subject-tax-law",
        contestId: "demo-sefaz",
        name: "Tax Law",
        plannedStudyMinutes: 50
      });
      await createStudyItem.execute({
        id: "item-portuguese-1",
        subjectId: "subject-portuguese",
        title: "Sintaxe"
      });
      await createStudyItem.execute({
        id: "item-portuguese-2",
        subjectId: "subject-portuguese",
        title: "Pontua\xE7\xE3o"
      });
      await createTopic.execute({
        id: "topic-portuguese-1",
        subjectId: "subject-portuguese",
        name: "Ora\xE7\xF5es subordinadas"
      });
      await updateContestWall.execute({
        contestId: "demo-trt",
        wall: {
          noticeLinks: [{ id: "notice-demo", label: "Edital", url: "https://example.com/edital" }],
          examLinks: [{ id: "exam-demo", label: "Prova anterior", url: "https://example.com/prova" }],
          subjectSnapshots: [{ subjectId: "subject-portuguese", weight: 2, score: 10 }],
          notes: "Dados de demonstra\xE7\xE3o do Corvo."
        }
      });
      await updateContestWall.execute({
        contestId: "demo-sefaz",
        wall: {
          noticeLinks: [{ id: "notice-sefaz", label: "Edital", url: "https://example.com/sefaz-edital" }],
          examLinks: [],
          subjectSnapshots: [{ subjectId: "subject-tax-law", weight: 3, score: 15 }],
          notes: "Foco em legisla\xE7\xE3o tribut\xE1ria."
        }
      });
      await registerStudySession.execute({
        id: "session-demo-1",
        contestId: "demo-trt",
        subjectId: "subject-portuguese",
        topicId: "topic-portuguese-1",
        type: "pdf",
        studiedAt: (/* @__PURE__ */ new Date()).toISOString(),
        pagesOrCount: 25,
        completed: true
      });
      await registerStudySession.execute({
        id: "session-demo-2",
        contestId: "demo-sefaz",
        subjectId: "subject-tax-law",
        type: "questions",
        studiedAt: (/* @__PURE__ */ new Date()).toISOString(),
        pagesOrCount: 10,
        correctAnswers: 8,
        completed: true
      });
      new import_obsidian.Notice("Corvo demo data created.");
    }
  });
  plugin.addCommand({
    id: "corvo-switch-active-contest",
    name: "Switch active contest",
    callback: async () => {
      const data = await dataStore.load();
      if (data.contests.length < 2) {
        new import_obsidian.Notice("At least two contests are required to switch the active contest.");
        return;
      }
      const currentIndex = data.contests.findIndex((contest) => contest.id === data.activeContestId);
      const nextContest = data.contests[(currentIndex + 1 + data.contests.length) % data.contests.length];
      await setActiveContest.execute({ contestId: nextContest.id });
      new import_obsidian.Notice(`Active contest switched to: ${nextContest.name}`);
    }
  });
  plugin.addCommand({
    id: "corvo-show-active-subjects",
    name: "Show active contest subjects",
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();
      if (subjects.length === 0) {
        new import_obsidian.Notice("No subjects found for the active contest.");
        return;
      }
      new import_obsidian.Notice(
        subjects.map((subject) => {
          const stage = subject.currentStage ?? "no stage";
          const state = subject.isActive ? "active" : "inactive";
          return `${subject.order}. ${subject.name} [${state}] ${subject.plannedStudyMinutes}m (${stage})`;
        }).join(" | ")
      );
    }
  });
  plugin.addCommand({
    id: "corvo-reorder-active-subjects",
    name: "Reorder active contest subjects",
    callback: async () => {
      const data = await dataStore.load();
      const subjects = await listSubjectsForActiveContest.execute();
      if (!data.activeContestId || subjects.length < 2) {
        new import_obsidian.Notice("At least two subjects are required to reorder the active contest.");
        return;
      }
      await reorderSubjects.execute({
        contestId: data.activeContestId,
        subjectIdsInOrder: subjects.map((subject) => subject.id).reverse()
      });
      new import_obsidian.Notice("Active contest subjects reordered.");
    }
  });
  plugin.addCommand({
    id: "corvo-toggle-first-subject-active",
    name: "Toggle first subject active state",
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();
      const subject = subjects[0];
      if (!subject) {
        new import_obsidian.Notice("No subject found for the active contest.");
        return;
      }
      const updatedSubject = await setSubjectActiveState.execute({
        subjectId: subject.id,
        isActive: !subject.isActive
      });
      new import_obsidian.Notice(`Subject ${updatedSubject.name} is now ${updatedSubject.isActive ? "active" : "inactive"}.`);
    }
  });
  plugin.addCommand({
    id: "corvo-update-first-subject-config",
    name: "Update first subject configuration",
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();
      const subject = subjects[0];
      if (!subject) {
        new import_obsidian.Notice("No subject found for the active contest.");
        return;
      }
      const updatedSubject = await updateSubjectConfiguration.execute({
        subjectId: subject.id,
        plannedStudyMinutes: subject.plannedStudyMinutes + 15,
        currentStage: "Review"
      });
      new import_obsidian.Notice(
        `Subject ${updatedSubject.name} updated to ${updatedSubject.plannedStudyMinutes} minutes and stage ${updatedSubject.currentStage}.`
      );
    }
  });
  plugin.addCommand({
    id: "corvo-advance-cycle",
    name: "Advance cycle",
    callback: async () => {
      try {
        const state = await advanceCycle.execute();
        new import_obsidian.Notice(`Current subject: ${state.currentSubjectId ?? "none"}`);
      } catch (error) {
        new import_obsidian.Notice(error instanceof Error ? error.message : "Could not advance cycle.");
      }
    }
  });
  plugin.addCommand({
    id: "corvo-show-cycle-snapshot",
    name: "Show cycle snapshot",
    callback: async () => {
      try {
        const snapshot = await getActiveCycleSnapshot.execute();
        const currentLabel = snapshot.currentSubject?.name ?? "none";
        const nextLabel = snapshot.nextSubject?.name ?? "none";
        new import_obsidian.Notice(
          `Current: ${currentLabel} | Next: ${nextLabel} | Current item: ${snapshot.currentItemId ?? "none"} | Next item: ${snapshot.nextItemId ?? "none"}`
        );
      } catch (error) {
        new import_obsidian.Notice(error instanceof Error ? error.message : "Could not read cycle snapshot.");
      }
    }
  });
  plugin.addCommand({
    id: "corvo-show-active-contest-wall",
    name: "Show active contest wall",
    callback: async () => {
      const data = await dataStore.load();
      const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);
      if (!activeContest) {
        new import_obsidian.Notice("No active contest configured.");
        return;
      }
      new import_obsidian.Notice(
        `${activeContest.name}: notices ${activeContest.wall.noticeLinks.length}, exams ${activeContest.wall.examLinks.length}, notes ${activeContest.wall.notes ?? "none"}`
      );
    }
  });
  plugin.addCommand({
    id: "corvo-show-summary",
    name: "Show active contest summary",
    callback: async () => {
      try {
        const summary = await getActiveContestSummary.execute();
        if (summary.subjectSummaries.length === 0) {
          new import_obsidian.Notice("No subject summary available for the active contest.");
          return;
        }
        const message = summary.subjectSummaries.map((subjectSummary) => {
          const accuracy = subjectSummary.questionAccuracy === null ? "n/a" : `${Math.round(subjectSummary.questionAccuracy * 100)}%`;
          return `${subjectSummary.subjectName}: PDF ${subjectSummary.pdfProgressCount}, Questions ${subjectSummary.questionProgressCount}, Accuracy ${accuracy}`;
        }).join(" | ");
        new import_obsidian.Notice(message);
      } catch (error) {
        new import_obsidian.Notice(error instanceof Error ? error.message : "Could not load active contest summary.");
      }
    }
  });
  plugin.addCommand({
    id: "corvo-register-demo-question-session",
    name: "Register demo question session",
    callback: async () => {
      const data = await dataStore.load();
      if (!data.activeContestId) {
        new import_obsidian.Notice("No active contest configured.");
        return;
      }
      const contestState = data.contestStates.find((state) => state.contestId === data.activeContestId);
      const activeSubject = data.subjects.find((subject) => subject.id === contestState?.currentSubjectId) ?? data.subjects.find((subject) => subject.contestId === data.activeContestId);
      if (!activeSubject) {
        new import_obsidian.Notice("No subject available for the active contest.");
        return;
      }
      const topic = data.topics.find((candidate) => candidate.subjectId === activeSubject.id);
      await registerStudySession.execute({
        id: `session-demo-${Date.now()}`,
        contestId: data.activeContestId,
        subjectId: activeSubject.id,
        topicId: topic?.id,
        type: "questions",
        studiedAt: (/* @__PURE__ */ new Date()).toISOString(),
        pagesOrCount: 10,
        correctAnswers: 8,
        completed: true
      });
      new import_obsidian.Notice(`Demo question session registered for: ${activeSubject.name}`);
    }
  });
  plugin.addCommand({
    id: "corvo-register-demo-video-session",
    name: "Register demo video session",
    callback: async () => {
      const data = await dataStore.load();
      if (!data.activeContestId) {
        new import_obsidian.Notice("No active contest configured.");
        return;
      }
      const activeSubject = (await listSubjectsForActiveContest.execute())[0];
      if (!activeSubject) {
        new import_obsidian.Notice("No subject available for the active contest.");
        return;
      }
      await registerStudySession.execute({
        id: `session-video-${Date.now()}`,
        contestId: data.activeContestId,
        subjectId: activeSubject.id,
        type: "video",
        studiedAt: (/* @__PURE__ */ new Date()).toISOString(),
        pagesOrCount: 1,
        completed: true
      });
      new import_obsidian.Notice(`Demo video session registered for: ${activeSubject.name}`);
    }
  });
  plugin.addCommand({
    id: "corvo-reset-demo-data",
    name: "Reset plugin data",
    callback: async () => {
      await dataStore.save(createDefaultCorvoPluginData());
      new import_obsidian.Notice("Corvo data reset.");
    }
  });
}

// src/ui/settings/CorvoSettingTab.ts
var import_obsidian11 = require("obsidian");

// src/ui/view/CorvoView.ts
var import_obsidian10 = require("obsidian");

// src/application/use-cases/DeleteContestUseCase.ts
var DeleteContestUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.contestRepository = new EntityRepository(dataStore, "contests");
  }
  async execute(input) {
    const contest = await this.contestRepository.findById(input.contestId);
    await this.contestRepository.delete(input.contestId);
    return contest;
  }
};

// src/domain/services/CsvExportService.ts
var CsvExportService = class {
  /**
   * Converts an array of records to a CSV string.
   * @param records - Array of objects to convert
   * @returns CSV string with BOM prefix
   */
  static export(records) {
    if (records.length === 0) {
      return this.BOM;
    }
    const headers = Object.keys(records[0]);
    const lines = [this.formatRow(headers)];
    records.forEach((record) => {
      const values = headers.map((header) => this.formatValue(record[header]));
      lines.push(this.formatRow(values));
    });
    return this.BOM + lines.join(this.LINE_BREAK);
  }
  /**
   * Triggers a browser download of a CSV file.
   * @param csvContent - The CSV content string
   * @param filename - The desired filename (without extension)
   */
  static download(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  static formatRow(values) {
    return values.join(this.DELIMITER);
  }
  static formatValue(value) {
    if (value === void 0 || value === null) {
      return "";
    }
    const stringValue = String(value);
    if (stringValue.includes(this.DELIMITER) || stringValue.includes('"') || stringValue.includes(this.LINE_BREAK)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }
};
CsvExportService.DELIMITER = ",";
CsvExportService.LINE_BREAK = "\n";
CsvExportService.BOM = "\uFEFF";

// src/application/use-cases/ExportToCsvUseCase.ts
var ExportToCsvUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }
  async execute(input) {
    const data = await this.dataStore.load();
    const contestId = input.contestId ?? data.activeContestId;
    switch (input.entityType) {
      case "sessions":
        return this.exportSessions(data, contestId);
      case "items":
        return this.exportItems(data, input.subjectId);
      case "topics":
        return this.exportTopics(data, input.subjectId);
      case "subjects":
        return this.exportSubjects(data, contestId);
      case "contests":
        return this.exportContests(data);
    }
  }
  exportSessions(data, contestId) {
    const sessions = data.studySessions.filter((s) => contestId ? s.contestId === contestId : true).map((s) => {
      const subject = data.subjects.find((sub) => sub.id === s.subjectId);
      const topic = data.topics.find((t) => t.id === s.topicId);
      const item = data.studyItems.find((i) => i.id === s.studyItemId);
      return {
        Data: new Date(s.studiedAt).toLocaleDateString("pt-BR"),
        Mat\u00E9ria: subject?.name ?? "",
        Assunto: topic?.name ?? "",
        Item: item?.title ?? "",
        Tipo: s.type,
        Quantidade: s.pagesOrCount ?? 0,
        Acertos: s.correctAnswers ?? 0,
        Conclu\u00EDdo: s.completed ? "Sim" : "N\xE3o"
      };
    });
    const csv = CsvExportService.export(sessions);
    CsvExportService.download(csv, `sessoes-${contestId ?? "todos"}`);
  }
  exportItems(data, subjectId) {
    const items = data.studyItems.filter((i) => subjectId ? i.subjectId === subjectId : true).map((i) => {
      const subject = data.subjects.find((s) => s.id === i.subjectId);
      return {
        Ordem: i.order,
        Mat\u00E9ria: subject?.name ?? "",
        Item: i.title,
        Peso: i.weight ?? 0,
        "Total Quest\xF5es": i.questionCount ?? 0,
        Refer\u00EAncias: i.resourceReferences?.length ?? 0
      };
    });
    const csv = CsvExportService.export(items);
    CsvExportService.download(csv, `itens-${subjectId ?? "todos"}`);
  }
  exportTopics(data, subjectId) {
    const topics = data.topics.filter((t) => subjectId ? t.subjectId === subjectId : true).map((t) => {
      const subject = data.subjects.find((s) => s.id === t.subjectId);
      return {
        Ordem: t.order,
        Mat\u00E9ria: subject?.name ?? "",
        Assunto: t.name,
        Caderno: t.questionNotebook?.name ?? "",
        Resolvidas: t.questionNotebook?.solvedQuestions ?? 0,
        Acertos: t.questionNotebook?.correctAnswers ?? 0,
        Refer\u00EAncias: t.resourceReferences.length
      };
    });
    const csv = CsvExportService.export(topics);
    CsvExportService.download(csv, `assuntos-${subjectId ?? "todos"}`);
  }
  exportSubjects(data, contestId) {
    const subjects = data.subjects.filter((s) => contestId ? s.contestId === contestId : true).map((s) => ({
      Ordem: s.order,
      Nome: s.name,
      "Minutos Planejados": s.plannedStudyMinutes,
      Etapa: s.currentStage ?? "",
      Ativa: s.isActive ? "Sim" : "N\xE3o",
      "Total Itens": data.studyItems.filter((i) => i.subjectId === s.id).length,
      "Total Assuntos": data.topics.filter((t) => t.subjectId === s.id).length
    }));
    const csv = CsvExportService.export(subjects);
    CsvExportService.download(csv, `materias-${contestId ?? "todos"}`);
  }
  exportContests(data) {
    const contests = data.contests.map((c) => ({
      ID: c.id,
      Nome: c.name,
      Notas: c.wall.notes ?? "",
      "Links Edital": c.wall.noticeLinks.length,
      "Links Prova": c.wall.examLinks.length,
      "Snapshots Mat\xE9rias": c.wall.subjectSnapshots.length,
      Ativo: data.activeContestId === c.id ? "Sim" : "N\xE3o"
    }));
    const csv = CsvExportService.export(contests);
    CsvExportService.download(csv, "concursos");
  }
};

// src/application/use-cases/UpdateContestUseCase.ts
var UpdateContestUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.contestRepository = new EntityRepository(dataStore, "contests");
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

// src/ui/view/shared/DomHelpers.ts
var import_obsidian2 = require("obsidian");

// src/ui/constants/index.ts
var ICON_NAMES = {
  dashboard: "layout-dashboard",
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
  { id: "dashboard", label: "Dashboard", icon: ICON_NAMES.dashboard },
  { id: "contests", label: "Concursos", icon: ICON_NAMES.contests },
  { id: "cycle", label: "Ciclo e Mat\xE9rias", icon: ICON_NAMES.cycle },
  { id: "items", label: "Itens e PDFs", icon: ICON_NAMES.items },
  { id: "topics", label: "Assuntos e Quest\xF5es", icon: ICON_NAMES.topics },
  { id: "sessions", label: "Sess\xF5es", icon: ICON_NAMES.sessions },
  { id: "wall", label: "Mural", icon: ICON_NAMES.wall }
];

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
  static createIcon(iconKey, className = "corvo-icon") {
    const container = this.createElement("span", className);
    const iconName = ICON_NAMES[iconKey] || iconKey;
    if (typeof import_obsidian2.setIcon === "function") {
      (0, import_obsidian2.setIcon)(container, iconName);
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
    const wrapper = this.createElement("span", "corvo-text-with-icon");
    if (icon) {
      wrapper.appendChild(this.createIcon(icon));
    }
    const label = this.createElement("span", "corvo-text-label");
    label.textContent = text;
    wrapper.appendChild(label);
    return wrapper;
  }
  /**
   * Creates an H1 heading with optional icon.
   */
  static createHeading(text, icon) {
    const heading = this.createElement("h1", "corvo-title");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }
  /**
   * Creates an H2 section title with optional icon.
   */
  static createSectionTitle(text, icon) {
    const heading = this.createElement("h2", "corvo-section-title");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }
  /**
   * Creates an H3 section subtitle with optional icon.
   */
  static createSectionSubtitle(text, icon) {
    const heading = this.createElement("h3", "corvo-section-subtitle");
    heading.appendChild(this.createTextWithIcon(text, icon));
    return heading;
  }
  /**
   * Creates a paragraph element.
   */
  static createParagraph(text) {
    const paragraph = this.createElement("p", "corvo-paragraph");
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
    const badge = this.createElement("span", "corvo-badge");
    badge.appendChild(this.createTextWithIcon(text, icon));
    return badge;
  }
  /**
   * Creates a card section with title and optional icon.
   */
  static createCard(title, icon) {
    const card = this.createElement("section", "corvo-card");
    card.appendChild(this.createSectionSubtitle(title, icon));
    return card;
  }
  /**
   * Creates an empty state message.
   */
  static createEmptyState(title, description) {
    const wrapper = this.createElement("section", "corvo-empty-state corvo-card");
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
    input.className = "corvo-input";
    return input;
  }
  /**
   * Creates a select dropdown with options.
   * @param options - Array of [value, label] pairs
   * @param selectedValue - Optional value to pre-select
   */
  static createSelect(options, selectedValue) {
    const select = document.createElement("select");
    select.className = "corvo-select";
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
    textarea.className = "corvo-textarea";
    return textarea;
  }
  /**
   * Creates a label for a form control.
   */
  static createLabel(text, control) {
    const label = this.createElement("label", "corvo-label");
    const span = this.createElement("span", "corvo-label-text");
    span.textContent = text;
    label.append(span, control);
    return label;
  }
  /**
   * Creates a disclosure (details/summary) element.
   */
  static createDisclosure(title, content, icon) {
    const details = this.createElement("details", "corvo-disclosure");
    const summary = this.createElement("summary", "corvo-disclosure-summary");
    summary.appendChild(this.createTextWithIcon(title, icon));
    details.append(summary, content);
    return details;
  }
  /**
   * Creates a key-value row display.
   */
  static createKeyValueRow(label, value) {
    const row = this.createElement("div", "corvo-key-value");
    const labelEl = this.createElement("span", "corvo-key-label");
    labelEl.textContent = label;
    const valueEl = this.createElement("span", "corvo-key-value-text");
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
    const wrapper = this.createElement("div", "corvo-table-wrapper");
    const table = this.createElement("table", "corvo-table");
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
    button.className = options.className || "corvo-button";
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
    button.className = options.className || "corvo-icon-button";
    button.appendChild(this.createIcon(icon, "corvo-icon-button-icon"));
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([key, value]) => {
        button.dataset[key] = value;
      });
    }
    if (options.onClick) {
      button.addEventListener("click", options.onClick);
    }
    if (typeof import_obsidian2.setTooltip === "function") {
      (0, import_obsidian2.setTooltip)(button, title, { delay: 300 });
    } else {
      button.title = title;
    }
    return button;
  }
  /**
   * Creates a button group container.
   */
  static createButtonGroup() {
    return this.createElement("div", "corvo-button-group");
  }
  /**
   * Creates a form element.
   */
  static createForm(onSubmit) {
    const form = document.createElement("form");
    form.className = "corvo-form";
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
    input.className = "corvo-input corvo-input-compact";
    return input;
  }
  /**
   * Creates a table with inline CRUD support.
   * Returns a container with the table.
   */
  static createCrudTable(headers) {
    const container = this.createElement("div", "corvo-table-wrapper");
    const table = this.createElement("table", "corvo-table");
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
    const actions = this.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    actions.appendChild(
      this.createIconButton("edit", "Editar", { onClick: onEdit })
    );
    actions.appendChild(
      this.createIconButton("delete", "Excluir", { onClick: onDelete })
    );
    return actions;
  }
  /**
   * Creates a form row for organizing form elements.
   */
  static createFormRow() {
    return this.createElement("div", "corvo-form-row");
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
    const card = this.createElement("section", "corvo-card corvo-create-form");
    card.appendChild(this.createSectionSubtitle(title, "add"));
    const form = this.createForm(onSubmit);
    const actions = this.createElement("div", "corvo-form-actions");
    actions.appendChild(
      this.createButton("Cancelar", {
        className: "corvo-button",
        onClick: () => onCancel()
      })
    );
    actions.appendChild(
      this.createButton("Criar", {
        type: "submit",
        className: "corvo-primary-button"
      })
    );
    card.appendChild(form);
    card.appendChild(actions);
    return card;
  }
  /**
   * Displays an error notification using Obsidian's Notice.
   * Checks for specific error types to provide better messages.
   */
  static notifyError(error, fallbackMessage) {
    new import_obsidian2.Notice(error instanceof Error ? error.message : fallbackMessage);
  }
};

// src/ui/view/components/ContestsTab.ts
var import_obsidian3 = require("obsidian");
var ContestsTab = class {
  constructor(dataStore, onUpdate) {
    this.dataStore = dataStore;
    this.onUpdate = onUpdate;
    this.editingContestId = null;
    this.isCreatingNew = false;
    this.createContestUseCase = new CreateContestUseCase(dataStore);
    this.setActiveContestUseCase = new SetActiveContestUseCase(dataStore);
    this.updateContestUseCase = new UpdateContestUseCase(dataStore);
    this.deleteContestUseCase = new DeleteContestUseCase(dataStore);
    this.exportToCsvUseCase = new ExportToCsvUseCase(dataStore);
  }
  async render(container, data) {
    const header = DomHelpers.createElement("div", "corvo-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Concursos"));
    const actions = DomHelpers.createElement("div", "corvo-inline-actions");
    actions.appendChild(
      DomHelpers.createIconButton("add", "Novo concurso", {
        onClick: async () => {
          this.isCreatingNew = true;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("download", "Exportar CSV", {
        onClick: async () => {
          try {
            await this.exportToCsvUseCase.execute({ entityType: "contests" });
          } catch (error) {
            this.notifyError(error, "N\xE3o foi poss\xEDvel exportar.");
          }
        }
      })
    );
    header.appendChild(actions);
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph("Cadastre concursos e defina qual deles est\xE1 ativo.")
    );
    if (this.isCreatingNew) {
      container.appendChild(this.renderCreateContestForm());
    }
    const contestsCard = DomHelpers.createCard("Lista de concursos");
    if (data.contests.length === 0) {
      contestsCard.appendChild(DomHelpers.createParagraph("Nenhum concurso cadastrado."));
    }
    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Concurso",
      "ID",
      "Notas",
      "Status",
      "A\xE7\xF5es"
    ]);
    data.contests.forEach((contest) => {
      const isEditing = this.editingContestId === contest.id;
      if (isEditing) {
        tbody.appendChild(this.renderEditableRow(contest, data));
      } else {
        tbody.appendChild(this.renderDisplayRow(contest, data));
      }
    });
    contestsCard.appendChild(tableContainer);
    container.appendChild(contestsCard);
  }
  renderDisplayRow(contest, data) {
    const tr = DomHelpers.createElement("tr");
    const isActive = data.activeContestId === contest.id;
    tr.appendChild(DomHelpers.createCell(contest.name));
    tr.appendChild(DomHelpers.createCell(contest.id));
    tr.appendChild(DomHelpers.createCell(contest.wall.notes ?? "\u2014"));
    tr.appendChild(DomHelpers.createCell(isActive ? "Ativo" : "Inativo"));
    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    if (!isActive) {
      actions.appendChild(
        DomHelpers.createIconButton("toggleOn", "Ativar", {
          dataset: { contestId: contest.id },
          onClick: async () => {
            try {
              await this.setActiveContestUseCase.execute({ contestId: contest.id });
              await this.onUpdate();
            } catch (error) {
              this.notifyError(error, "N\xE3o foi poss\xEDvel ativar o concurso.");
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
          if (confirm(`Excluir "${contest.name}"?`)) {
            try {
              await this.deleteContestUseCase.execute({ contestId: contest.id });
              await this.onUpdate();
            } catch (error) {
              this.notifyError(error, "N\xE3o foi poss\xEDvel excluir o concurso.");
            }
          }
        }
      })
    );
    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);
    return tr;
  }
  renderEditableRow(contest, data) {
    const tr = DomHelpers.createElement("tr");
    tr.className = "corvo-editing-row";
    const nameInput = DomHelpers.createCompactInput("text", "Nome", contest.name);
    const notesInput = DomHelpers.createCompactInput("text", "Notas", contest.wall.notes ?? "");
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
          this.notifyError(error, "N\xE3o foi poss\xEDvel salvar.");
        }
      }
    });
    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingContestId = null;
        await this.onUpdate();
      }
    });
    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    tr.appendChild(DomHelpers.createCell(null, nameInput));
    tr.appendChild(DomHelpers.createCell(contest.id));
    tr.appendChild(DomHelpers.createCell(null, notesInput));
    tr.appendChild(DomHelpers.createCell(data.activeContestId === contest.id ? "Ativo" : "Inativo"));
    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);
    return tr;
  }
  renderCreateContestForm() {
    const idInput = DomHelpers.createInput("text", "ID do concurso");
    const nameInput = DomHelpers.createInput("text", "Nome do concurso");
    const form = DomHelpers.createInlineForm(
      "Novo concurso",
      async () => {
        try {
          await this.createContestUseCase.execute({
            id: idInput.value.trim(),
            name: nameInput.value.trim()
          });
          idInput.value = "";
          nameInput.value = "";
          this.isCreatingNew = false;
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "N\xE3o foi poss\xEDvel criar o concurso.");
        }
      },
      () => {
        this.isCreatingNew = false;
        this.onUpdate();
      }
    );
    const innerForm = form.querySelector("form");
    innerForm.append(
      DomHelpers.createLabel("ID", idInput),
      DomHelpers.createLabel("Nome", nameInput)
    );
    return form;
  }
  notifyError(error, fallbackMessage) {
    new import_obsidian3.Notice(error instanceof Error ? error.message : fallbackMessage);
  }
};

// src/ui/view/components/CycleTab.ts
var import_obsidian4 = require("obsidian");
var CycleTab = class {
  constructor(dataStore, onUpdate) {
    this.dataStore = dataStore;
    this.onUpdate = onUpdate;
    this.editingSubjectId = null;
    this.isCreatingNew = false;
    this.createSubjectUseCase = new CreateSubjectUseCase(dataStore);
    this.listSubjectsForActiveContestUseCase = new ListSubjectsForActiveContestUseCase(dataStore);
    this.reorderSubjectsUseCase = new ReorderSubjectsUseCase(dataStore);
    this.setSubjectActiveStateUseCase = new SetSubjectActiveStateUseCase(dataStore);
    this.updateSubjectConfigurationUseCase = new UpdateSubjectConfigurationUseCase(dataStore);
    this.exportToCsvUseCase = new ExportToCsvUseCase(dataStore);
  }
  /**
   * Renders the cycle tab content.
   */
  async render(container, data) {
    const header = DomHelpers.createElement("div", "corvo-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Ciclo e Mat\xE9rias"));
    const actions = DomHelpers.createElement("div", "corvo-inline-actions");
    actions.appendChild(
      DomHelpers.createIconButton("add", "Nova mat\xE9ria", {
        onClick: async () => {
          this.isCreatingNew = true;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("download", "Exportar CSV", {
        onClick: async () => {
          try {
            await this.exportToCsvUseCase.execute({ entityType: "subjects" });
          } catch (error) {
            this.notifyError(error, "N\xE3o foi poss\xEDvel exportar.");
          }
        }
      })
    );
    header.appendChild(actions);
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph("Gerencie a ordem, o status, o tempo e a etapa das mat\xE9rias.")
    );
    if (this.isCreatingNew) {
      container.appendChild(this.renderCreateSubjectForm(data));
    }
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId) ?? null;
    const subjects = await this.listSubjectsForActiveContestUseCase.execute();
    const card = DomHelpers.createCard(
      activeContest ? `Mat\xE9rias de ${activeContest.name}` : "Mat\xE9rias"
    );
    if (subjects.length === 0) {
      card.appendChild(
        DomHelpers.createParagraph("Nenhuma mat\xE9ria cadastrada para o concurso ativo.")
      );
      container.appendChild(card);
      return;
    }
    const tableWrapper = DomHelpers.createElement("div", "corvo-table-wrapper");
    const table = DomHelpers.createElement("table", "corvo-table");
    const thead = DomHelpers.createElement("thead");
    const headerRow = DomHelpers.createElement("tr");
    ["", "Ordem", "Mat\xE9ria", "Tempo", "Etapa", "Status", "A\xE7\xF5es"].forEach((header2, index) => {
      const th = DomHelpers.createElement("th");
      th.textContent = header2;
      if (index === 0) {
        th.className = "corvo-th-reorder";
      }
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
    tr.appendChild(DomHelpers.createCell(null, this.renderReorderCell(subject, subjects, index, activeContestId)));
    tr.appendChild(DomHelpers.createCell(String(subject.order)));
    tr.appendChild(DomHelpers.createCell(subject.name));
    tr.appendChild(DomHelpers.createCell(`${subject.plannedStudyMinutes} min`));
    tr.appendChild(DomHelpers.createCell(subject.currentStage ?? "\u2014"));
    tr.appendChild(this.renderStatusCell(subject, activeContestId));
    tr.appendChild(DomHelpers.createCell(null, this.renderEditCell(subject)));
    return tr;
  }
  renderEditableRow(subject, subjects, index, activeContestId) {
    const tr = DomHelpers.createElement("tr");
    tr.className = "corvo-editing-row";
    const minutesInput = DomHelpers.createInput(
      "number",
      "Min",
      String(subject.plannedStudyMinutes)
    );
    minutesInput.className = "corvo-input corvo-input-compact";
    const stageInput = DomHelpers.createInput("text", "Etapa", subject.currentStage ?? "");
    stageInput.className = "corvo-input corvo-input-compact";
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
          this.notifyError(error, "N\xE3o foi poss\xEDvel salvar a configura\xE7\xE3o.");
        }
      }
    });
    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingSubjectId = null;
        await this.onUpdate();
      }
    });
    const controls = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    controls.appendChild(saveButton);
    controls.appendChild(cancelButton);
    if (index > 0) {
      controls.appendChild(
        DomHelpers.createIconButton("up", "Subir", {
          onClick: async () => {
            await this.moveSubject(subjects, index, index - 1, activeContestId);
          }
        })
      );
    }
    if (index < subjects.length - 1) {
      controls.appendChild(
        DomHelpers.createIconButton("down", "Descer", {
          onClick: async () => {
            await this.moveSubject(subjects, index, index + 1, activeContestId);
          }
        })
      );
    }
    tr.appendChild(DomHelpers.createCell(""));
    tr.appendChild(DomHelpers.createCell(String(subject.order)));
    tr.appendChild(DomHelpers.createCell(subject.name));
    tr.appendChild(DomHelpers.createCell(null, minutesInput));
    tr.appendChild(DomHelpers.createCell(null, stageInput));
    tr.appendChild(DomHelpers.createCell(subject.isActive ? "Ativa" : "Inativa"));
    tr.appendChild(DomHelpers.createCell(null, controls));
    return tr;
  }
  renderCreateSubjectForm(data) {
    const activeContestId = data.activeContestId;
    const nameInput = DomHelpers.createInput("text", "Nome da mat\xE9ria");
    const minutesInput = DomHelpers.createInput("number", "Minutos planejados", "60");
    const form = DomHelpers.createInlineForm(
      "Nova mat\xE9ria",
      async () => {
        try {
          if (!activeContestId) {
            throw new NoActiveContestError();
          }
          await this.createSubjectUseCase.execute({
            id: `${activeContestId}-subject-${Date.now()}`,
            contestId: activeContestId,
            name: nameInput.value,
            plannedStudyMinutes: Number(minutesInput.value)
          });
          nameInput.value = "";
          minutesInput.value = "60";
          this.isCreatingNew = false;
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "N\xE3o foi poss\xEDvel criar a mat\xE9ria.");
        }
      },
      () => {
        this.isCreatingNew = false;
        this.onUpdate();
      }
    );
    const innerForm = form.querySelector("form");
    innerForm.append(
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createLabel("Minutos", minutesInput)
    );
    return form;
  }
  renderReorderCell(subject, subjects, index, activeContestId) {
    const cell = DomHelpers.createElement("div", "corvo-reorder-cell");
    if (index > 0) {
      cell.appendChild(
        DomHelpers.createIconButton("up", "Subir", {
          className: "corvo-reorder-button",
          onClick: async () => {
            await this.moveSubject(subjects, index, index - 1, activeContestId);
          }
        })
      );
    }
    if (index < subjects.length - 1) {
      cell.appendChild(
        DomHelpers.createIconButton("down", "Descer", {
          className: "corvo-reorder-button",
          onClick: async () => {
            await this.moveSubject(subjects, index, index + 1, activeContestId);
          }
        })
      );
    }
    return cell;
  }
  renderStatusCell(subject, activeContestId) {
    const td = DomHelpers.createElement("td", "corvo-status-cell");
    const span = DomHelpers.createElement("span", subject.isActive ? "corvo-status-active" : "corvo-status-inactive");
    span.textContent = subject.isActive ? "Ativa" : "Inativa";
    td.appendChild(span);
    td.addEventListener("click", async () => {
      try {
        await this.setSubjectActiveStateUseCase.execute({
          subjectId: subject.id,
          isActive: !subject.isActive
        });
        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "N\xE3o foi poss\xEDvel alterar o status da mat\xE9ria.");
      }
    });
    return td;
  }
  renderEditCell(subject) {
    const cell = DomHelpers.createElement("div", "corvo-edit-cell");
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
      this.notifyError(error, "N\xE3o foi poss\xEDvel reordenar as mat\xE9rias.");
    }
  }
  notifyError(error, fallbackMessage) {
    if (error instanceof NoActiveContestError) {
      new import_obsidian4.Notice("Nenhum concurso ativo. Selecione um concurso para continuar.");
      return;
    }
    new import_obsidian4.Notice(error instanceof Error ? error.message : fallbackMessage);
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
        const progressCount = data.studySessions.filter(
          (session) => session.contestId === activeContestId && session.type === "pdf" && session.studyItemId === studyItem.id
        ).reduce((total, session) => total + (session.pagesOrCount ?? 0), 0);
        return {
          studyItemId: studyItem.id,
          title: studyItem.title,
          order: studyItem.order,
          progressCount,
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
        (session) => session.contestId === activeContestId && session.subjectId === subject.id && session.type === "questions"
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
var import_obsidian5 = require("obsidian");
var DashboardTab = class {
  constructor(dataStore, onUpdate) {
    this.dataStore = dataStore;
    this.onUpdate = onUpdate;
    this.advanceCycleUseCase = new AdvanceCycleUseCase(dataStore);
    this.getActiveCycleSnapshotUseCase = new GetActiveCycleSnapshotUseCase(dataStore);
    this.getActiveContestSummaryUseCase = new GetActiveContestSummaryUseCase(dataStore);
    this.getActiveContestProgressDashboardUseCase = new GetActiveContestProgressDashboardUseCase(dataStore);
    this.registerStudySessionUseCase = new RegisterStudySessionUseCase(dataStore);
    this.listSubjectsForActiveContestUseCase = new ListSubjectsForActiveContestUseCase(dataStore);
  }
  /**
   * Renders the dashboard tab content.
   */
  async render(container, data) {
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId) ?? null;
    if (!activeContest) {
      container.append(
        DomHelpers.createSectionTitle("Dashboard"),
        DomHelpers.createEmptyState(
          "Nenhum concurso ativo",
          "Crie um concurso na aba Concursos para come\xE7ar."
        )
      );
      return;
    }
    const snapshot = await this.getActiveCycleSnapshotUseCase.execute();
    const summary = await this.getActiveContestSummaryUseCase.execute();
    const progress = await this.getActiveContestProgressDashboardUseCase.execute();
    container.appendChild(DomHelpers.createSectionTitle("Dashboard"));
    container.appendChild(
      DomHelpers.createParagraph("Vis\xE3o geral do concurso ativo e das pr\xF3ximas a\xE7\xF5es.")
    );
    const overview = DomHelpers.createCard("Controle do ciclo");
    overview.appendChild(
      DomHelpers.createTable(
        ["Campo", "Valor"],
        [
          ["Concurso ativo", activeContest.name],
          ["Mat\xE9ria atual", snapshot.currentSubject?.name ?? "N\xE3o definida"],
          ["Pr\xF3xima mat\xE9ria", snapshot.nextSubject?.name ?? "N\xE3o definida"],
          ["Item atual", this.formatIdLabel(snapshot.currentItemId)],
          ["Pr\xF3ximo item", this.formatIdLabel(snapshot.nextItemId)]
        ]
      )
    );
    container.appendChild(overview);
    const cycleActions = DomHelpers.createCard("A\xE7\xF5es");
    const actionRow = DomHelpers.createElement("div", "corvo-inline-actions");
    actionRow.append(
      DomHelpers.createButton("Finalizar ciclo atual", {
        className: "corvo-primary-button",
        onClick: async () => {
          try {
            await this.advanceCycleUseCase.execute();
            await this.onUpdate();
          } catch (error) {
            this.notifyError(error, "N\xE3o foi poss\xEDvel finalizar o ciclo.");
          }
        }
      }),
      DomHelpers.createButton("Registrar sess\xE3o de quest\xF5es", {
        onClick: async () => {
          await this.registerQuickSession("questions");
        }
      }),
      DomHelpers.createButton("Registrar sess\xE3o de v\xEDdeo", {
        onClick: async () => {
          await this.registerQuickSession("video");
        }
      })
    );
    cycleActions.appendChild(actionRow);
    container.appendChild(cycleActions);
    const summaryList = DomHelpers.createElement("div", "corvo-grid corvo-grid-2");
    const subjectSummaryCard = DomHelpers.createCard("Resumo por mat\xE9ria");
    subjectSummaryCard.appendChild(
      DomHelpers.createTable(
        ["Mat\xE9ria", "Sess\xF5es", "PDF", "Quest\xF5es", "Acerto"],
        summary.subjectSummaries.map((subjectSummary) => [
          subjectSummary.subjectName,
          String(subjectSummary.totalSessions),
          String(subjectSummary.pdfProgressCount),
          String(subjectSummary.questionProgressCount),
          subjectSummary.questionAccuracy === null ? "-" : `${Math.round(subjectSummary.questionAccuracy * 100)}%`
        ])
      )
    );
    const progressCard = DomHelpers.createCard("Progresso");
    progressCard.appendChild(
      DomHelpers.createTable(
        ["Mat\xE9ria", "PDF", "Quest\xF5es", "Acerto total"],
        progress.questionProgressBySubject.map((questionProgress) => {
          const pdfProgress = progress.pdfProgressBySubject.find(
            (entry) => entry.subjectId === questionProgress.subjectId
          )?.totalProgressCount ?? 0;
          return [
            questionProgress.subjectName,
            String(pdfProgress),
            String(questionProgress.totalQuestionCount),
            questionProgress.totalAccuracy === null ? "-" : `${Math.round(questionProgress.totalAccuracy * 100)}%`
          ];
        })
      )
    );
    summaryList.append(subjectSummaryCard, progressCard);
    container.appendChild(summaryList);
  }
  /**
   * Formats an ID label for display.
   */
  formatIdLabel(id) {
    if (!id) return "N\xE3o definido";
    const parts = id.split("-");
    return parts.length > 0 ? parts[parts.length - 1] : id;
  }
  /**
   * Registers a quick study session for the current subject.
   */
  async registerQuickSession(type) {
    const data = await this.dataStore.load();
    if (!data.activeContestId) {
      new import_obsidian5.Notice("Nenhum concurso ativo.");
      return;
    }
    const subject = (await this.listSubjectsForActiveContestUseCase.execute())[0];
    if (!subject) {
      new import_obsidian5.Notice("Nenhuma mat\xE9ria ativa encontrada.");
      return;
    }
    const topic = data.topics.find((candidate) => candidate.subjectId === subject.id);
    await this.registerStudySessionUseCase.execute({
      id: `${type}-${Date.now()}`,
      contestId: data.activeContestId,
      subjectId: subject.id,
      topicId: topic?.id,
      type,
      studiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      pagesOrCount: type === "questions" ? 10 : 1,
      correctAnswers: type === "questions" ? 8 : void 0,
      completed: true
    });
    await this.onUpdate();
  }
  /**
   * Displays an error notification.
   */
  notifyError(error, fallbackMessage) {
    new import_obsidian5.Notice(error instanceof Error ? error.message : fallbackMessage);
  }
};

// src/ui/view/components/ItemsTab.ts
var import_obsidian6 = require("obsidian");

// src/application/use-cases/AddStudyItemResourceReferenceUseCase.ts
var AddStudyItemResourceReferenceUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.studyItemRepository = new EntityRepository(dataStore, "studyItems");
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
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.itemRepository = new EntityRepository(dataStore, "studyItems");
  }
  async execute(input) {
    const item = await this.itemRepository.findById(input.itemId);
    await this.itemRepository.delete(input.itemId);
    return item;
  }
};

// src/application/use-cases/UpdateStudyItemUseCase.ts
var UpdateStudyItemUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.itemRepository = new EntityRepository(dataStore, "studyItems");
  }
  async execute(input) {
    if (!input.itemId?.trim()) {
      throw new ValidationError("itemId is required");
    }
    if (input.weight !== void 0 && input.weight < 0) {
      throw new ValidationError("weight cannot be negative");
    }
    if (input.questionCount !== void 0 && input.questionCount < 0) {
      throw new ValidationError("questionCount cannot be negative");
    }
    return await this.itemRepository.update(input.itemId, (item) => ({
      ...item,
      weight: input.weight !== void 0 ? input.weight : item.weight,
      questionCount: input.questionCount !== void 0 ? input.questionCount : item.questionCount
    }));
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
    this.isCreatingNew = false;
    this.createStudyItemUseCase = new CreateStudyItemUseCase(dataStore);
    this.addStudyItemResourceReferenceUseCase = new AddStudyItemResourceReferenceUseCase(dataStore);
    this.getActiveContestProgressDashboardUseCase = new GetActiveContestProgressDashboardUseCase(dataStore);
    this.deleteStudyItemUseCase = new DeleteStudyItemUseCase(dataStore);
    this.updateStudyItemUseCase = new UpdateStudyItemUseCase(dataStore);
    this.exportToCsvUseCase = new ExportToCsvUseCase(dataStore);
  }
  async render(container, data) {
    const header = DomHelpers.createElement("div", "corvo-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Itens e PDFs"));
    const actions = DomHelpers.createElement("div", "corvo-inline-actions");
    actions.appendChild(
      DomHelpers.createIconButton("add", "Novo item", {
        onClick: async () => {
          this.isCreatingNew = true;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("download", "Exportar CSV", {
        onClick: async () => {
          try {
            await this.exportToCsvUseCase.execute({ entityType: "items", subjectId: this.selectedSubjectId ?? void 0 });
          } catch (error) {
            this.notifyError(error, "N\xE3o foi poss\xEDvel exportar.");
          }
        }
      })
    );
    header.appendChild(actions);
    container.appendChild(header);
    const subject = this.getSelectedSubject(data);
    if (!subject) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Nenhuma mat\xE9ria selecionada",
          "Cadastre mat\xE9rias no concurso ativo."
        )
      );
      return;
    }
    container.appendChild(this.renderSubjectPicker(data));
    if (this.isCreatingNew) {
      container.appendChild(this.renderCreateItemForm(subject.id));
    }
    const progress = await this.getActiveContestProgressDashboardUseCase.execute();
    const subjectProgress = progress.pdfProgressBySubject.find(
      (entry) => entry.subjectId === subject.id
    );
    const items = data.studyItems.filter((item) => item.subjectId === subject.id).sort((left, right) => left.order - right.order);
    const card = DomHelpers.createCard(`Itens de ${subject.name}`);
    if (items.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Nenhum item cadastrado."));
      container.appendChild(card);
      return;
    }
    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Ordem",
      "Item",
      "Peso",
      "Quest\xF5es",
      "PDF",
      "A\xE7\xF5es"
    ]);
    items.forEach((item) => {
      const itemProgress = subjectProgress?.items.find(
        (entry) => entry.studyItemId === item.id
      );
      const isEditing = this.editingItemId === item.id;
      const isExpanded = this.expandedItemId === item.id;
      if (isEditing) {
        tbody.appendChild(this.renderEditableRow(item, itemProgress, data));
      } else {
        tbody.appendChild(this.renderDisplayRow(item, itemProgress, data));
      }
      if (isExpanded && !isEditing) {
        tbody.appendChild(this.renderDetailRow(item, data));
      }
    });
    card.appendChild(tableContainer);
    container.appendChild(card);
  }
  renderDisplayRow(item, itemProgress, data) {
    const tr = DomHelpers.createElement("tr");
    const refs = item.resourceReferences ?? [];
    tr.appendChild(DomHelpers.createCell(String(item.order)));
    tr.appendChild(DomHelpers.createCell(item.title));
    tr.appendChild(DomHelpers.createCell(String(item.weight ?? 0)));
    tr.appendChild(DomHelpers.createCell(String(item.questionCount ?? 0)));
    tr.appendChild(DomHelpers.createCell(String(itemProgress?.progressCount ?? 0)));
    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    const hasRefs = refs.length > 0;
    actions.appendChild(
      DomHelpers.createIconButton(
        this.expandedItemId === item.id ? "collapse" : "expand",
        this.expandedItemId === item.id ? "Recolher" : "Expandir",
        {
          className: `corvo-icon-button ${hasRefs ? "" : "corvo-expand-button"}`,
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
          if (confirm(`Excluir "${item.title}"?`)) {
            try {
              await this.deleteStudyItemUseCase.execute({ itemId: item.id });
              await this.onUpdate();
            } catch (error) {
              this.notifyError(error, "N\xE3o foi poss\xEDvel excluir o item.");
            }
          }
        }
      })
    );
    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);
    return tr;
  }
  renderEditableRow(item, itemProgress, data) {
    const tr = DomHelpers.createElement("tr");
    tr.className = "corvo-editing-row";
    const weightInput = DomHelpers.createCompactInput("number", "Peso", String(item.weight ?? 0));
    const questionInput = DomHelpers.createCompactInput("number", "Qts", String(item.questionCount ?? 0));
    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateStudyItemUseCase.execute({
            itemId: item.id,
            weight: Number(weightInput.value),
            questionCount: Number(questionInput.value)
          });
          this.editingItemId = null;
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "N\xE3o foi poss\xEDvel salvar.");
        }
      }
    });
    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingItemId = null;
        await this.onUpdate();
      }
    });
    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    tr.appendChild(DomHelpers.createCell(String(item.order)));
    tr.appendChild(DomHelpers.createCell(item.title));
    tr.appendChild(DomHelpers.createCell(null, weightInput));
    tr.appendChild(DomHelpers.createCell(null, questionInput));
    tr.appendChild(DomHelpers.createCell(String(itemProgress?.progressCount ?? 0)));
    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);
    return tr;
  }
  renderDetailRow(item, data) {
    const tr = DomHelpers.createElement("tr");
    tr.className = "corvo-detail-row";
    const td = DomHelpers.createElement("td");
    td.colSpan = 6;
    const content = DomHelpers.createElement("div", "corvo-detail-content");
    if (item.resourceReferences && item.resourceReferences.length > 0) {
      const list = DomHelpers.createElement("div", "corvo-detail-list");
      item.resourceReferences.forEach((ref) => {
        const row = DomHelpers.createElement("div", "corvo-detail-list-item");
        row.appendChild(
          DomHelpers.createParagraph(`${ref.type}: ${ref.title}`)
        );
        if (ref.url) {
          const link = DomHelpers.createElement("a");
          link.href = ref.url;
          link.textContent = "\u{1F517}";
          link.target = "_blank";
          row.appendChild(link);
        }
        list.appendChild(row);
      });
      content.appendChild(list);
    }
    const titleInput = DomHelpers.createInput("text", "T\xEDtulo");
    const typeSelect = DomHelpers.createSelect([
      ["pdf", "pdf"],
      ["video", "video"],
      ["link", "link"],
      ["question-notebook", "question-notebook"]
    ]);
    const urlInput = DomHelpers.createInput("url", "URL");
    const form = DomHelpers.createForm(async () => {
      try {
        await this.addStudyItemResourceReferenceUseCase.execute({
          studyItemId: item.id,
          resourceReference: {
            id: `${item.id}-resource-${Date.now()}`,
            title: titleInput.value,
            type: typeSelect.value,
            url: urlInput.value
          }
        });
        titleInput.value = "";
        urlInput.value = "";
        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "N\xE3o foi poss\xEDvel adicionar refer\xEAncia.");
      }
    });
    form.className = "corvo-detail-form";
    form.append(
      DomHelpers.createLabel("T\xEDtulo", titleInput),
      DomHelpers.createLabel("Tipo", typeSelect),
      DomHelpers.createLabel("URL", urlInput),
      DomHelpers.createIconButton("add", "Adicionar", { onClick: () => form.requestSubmit() })
    );
    content.appendChild(form);
    td.appendChild(content);
    tr.appendChild(td);
    return tr;
  }
  renderCreateItemForm(subjectId) {
    const titleInput = DomHelpers.createInput("text", "T\xEDtulo do item");
    const weightInput = DomHelpers.createInput("number", "Peso", "1");
    const questionCountInput = DomHelpers.createInput("number", "Total de quest\xF5es", "0");
    const form = DomHelpers.createInlineForm(
      "Novo item",
      async () => {
        try {
          await this.createStudyItemUseCase.execute({
            id: `${subjectId}-item-${Date.now()}`,
            subjectId,
            title: titleInput.value,
            weight: Number(weightInput.value),
            questionCount: Number(questionCountInput.value)
          });
          titleInput.value = "";
          weightInput.value = "1";
          questionCountInput.value = "0";
          this.isCreatingNew = false;
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "N\xE3o foi poss\xEDvel criar o item.");
        }
      },
      () => {
        this.isCreatingNew = false;
        this.onUpdate();
      }
    );
    const innerForm = form.querySelector("form");
    innerForm.append(
      DomHelpers.createLabel("T\xEDtulo", titleInput),
      DomHelpers.createLabel("Peso", weightInput),
      DomHelpers.createLabel("Quest\xF5es", questionCountInput)
    );
    return form;
  }
  renderSubjectPicker(data) {
    const subjects = data.subjects.filter((subject) => subject.contestId === data.activeContestId).sort((left, right) => left.order - right.order);
    const select = DomHelpers.createSelect(
      subjects.map((subject) => [subject.id, subject.name]),
      this.selectedSubjectId ?? void 0
    );
    select.addEventListener("change", async () => {
      this.selectedSubjectId = select.value;
      await this.onUpdate();
    });
    const wrapper = DomHelpers.createElement("div", "corvo-toolbar");
    wrapper.appendChild(DomHelpers.createLabel("Mat\xE9ria", select));
    return wrapper;
  }
  getSelectedSubject(data) {
    const subjects = data.subjects.filter((subject) => subject.contestId === data.activeContestId).sort((left, right) => left.order - right.order);
    if (subjects.length === 0) return null;
    return subjects.find((subject) => subject.id === this.selectedSubjectId) ?? subjects[0];
  }
  notifyError(error, fallbackMessage) {
    new import_obsidian6.Notice(error instanceof Error ? error.message : fallbackMessage);
  }
};

// src/ui/view/components/SessionsTab.ts
var import_obsidian7 = require("obsidian");

// src/application/use-cases/DeleteStudySessionUseCase.ts
var DeleteStudySessionUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.sessionRepository = new EntityRepository(dataStore, "studySessions");
    this.topicRepository = new EntityRepository(dataStore, "topics");
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
    if (session.type !== "questions" || !session.topicId) {
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
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.sessionRepository = new EntityRepository(dataStore, "studySessions");
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
    this.isCreatingNew = false;
    this.registerStudySessionUseCase = new RegisterStudySessionUseCase(dataStore);
    this.deleteStudySessionUseCase = new DeleteStudySessionUseCase(dataStore);
    this.getActiveContestSummaryUseCase = new GetActiveContestSummaryUseCase(dataStore);
    this.listSubjectsForActiveContestUseCase = new ListSubjectsForActiveContestUseCase(dataStore);
    this.updateStudySessionUseCase = new UpdateStudySessionUseCase(dataStore);
    this.exportToCsvUseCase = new ExportToCsvUseCase(dataStore);
  }
  async render(container, data) {
    const header = DomHelpers.createElement("div", "corvo-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Sess\xF5es"));
    const actions = DomHelpers.createElement("div", "corvo-inline-actions");
    actions.appendChild(
      DomHelpers.createIconButton("add", "Nova sess\xE3o", {
        onClick: async () => {
          this.isCreatingNew = true;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("download", "Exportar CSV", {
        onClick: async () => {
          try {
            await this.exportToCsvUseCase.execute({ entityType: "sessions" });
          } catch (error) {
            this.notifyError(error, "N\xE3o foi poss\xEDvel exportar.");
          }
        }
      })
    );
    header.appendChild(actions);
    container.appendChild(header);
    container.appendChild(
      DomHelpers.createParagraph("Registre sess\xF5es manualmente e acompanhe o hist\xF3rico recente.")
    );
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId) ?? null;
    if (!activeContest) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Nenhum concurso ativo",
          "Selecione um concurso para registrar sess\xF5es."
        )
      );
      return;
    }
    const subjects = data.subjects.filter((subject) => subject.contestId === activeContest.id);
    if (this.isCreatingNew) {
      container.appendChild(this.renderSessionForm(activeContest.id, subjects, data));
    }
    const recentSessions = DomHelpers.createCard("Hist\xF3rico recente");
    const sessions = data.studySessions.filter((session) => session.contestId === activeContest.id).slice().reverse().slice(0, 10);
    if (sessions.length === 0) {
      recentSessions.appendChild(DomHelpers.createParagraph("Nenhuma sess\xE3o registrada."));
    } else {
      const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
        "Data",
        "Mat\xE9ria",
        "Assunto",
        "Tipo",
        "Progresso",
        "A\xE7\xF5es"
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
    const subjectName = data.subjects.find((subject) => subject.id === session.subjectId)?.name ?? "\u2014";
    const topicName = data.topics.find((topic) => topic.id === session.topicId)?.name ?? "\u2014";
    tr.appendChild(DomHelpers.createCell(new Date(session.studiedAt).toLocaleDateString("pt-BR")));
    tr.appendChild(DomHelpers.createCell(subjectName));
    tr.appendChild(DomHelpers.createCell(topicName));
    tr.appendChild(DomHelpers.createCell(this.formatSessionType(session.type)));
    tr.appendChild(DomHelpers.createCell(String(session.pagesOrCount ?? 0)));
    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
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
          if (confirm("Excluir esta sess\xE3o?")) {
            try {
              await this.deleteStudySessionUseCase.execute({ sessionId: session.id });
              await this.onUpdate();
            } catch (error) {
              this.notifyError(error, "N\xE3o foi poss\xEDvel excluir a sess\xE3o.");
            }
          }
        }
      })
    );
    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);
    return tr;
  }
  renderEditableRow(session, data) {
    const tr = DomHelpers.createElement("tr");
    tr.className = "corvo-editing-row";
    const countInput = DomHelpers.createCompactInput("number", "Qtd", String(session.pagesOrCount ?? 0));
    const saveButton = DomHelpers.createIconButton("save", "Salvar", {
      onClick: async () => {
        try {
          await this.updateStudySessionUseCase.execute({
            sessionId: session.id,
            pagesOrCount: Number(countInput.value)
          });
          this.editingSessionId = null;
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "N\xE3o foi poss\xEDvel salvar.");
        }
      }
    });
    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingSessionId = null;
        await this.onUpdate();
      }
    });
    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    const subjectName = data.subjects.find((subject) => subject.id === session.subjectId)?.name ?? "\u2014";
    const topicName = data.topics.find((topic) => topic.id === session.topicId)?.name ?? "\u2014";
    tr.appendChild(DomHelpers.createCell(new Date(session.studiedAt).toLocaleDateString("pt-BR")));
    tr.appendChild(DomHelpers.createCell(subjectName));
    tr.appendChild(DomHelpers.createCell(topicName));
    tr.appendChild(DomHelpers.createCell(this.formatSessionType(session.type)));
    tr.appendChild(DomHelpers.createCell(null, countInput));
    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);
    return tr;
  }
  renderSessionForm(contestId, subjects, data) {
    const card = DomHelpers.createElement("section", "corvo-card corvo-create-form");
    card.appendChild(DomHelpers.createSectionSubtitle("Nova sess\xE3o", "add"));
    const form = DomHelpers.createForm(async () => {
      try {
        await this.registerStudySessionUseCase.execute({
          id: `session-${Date.now()}`,
          contestId,
          subjectId: subjectSelect.value,
          studyItemId: itemSelect.value || void 0,
          topicId: topicSelect.value || void 0,
          type: typeSelect.value,
          studiedAt: dateInput.value,
          pagesOrCount: Number(countInput.value),
          correctAnswers: typeSelect.value === "questions" ? Number(correctInput.value) : void 0,
          completed: true
        });
        this.isCreatingNew = false;
        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "N\xE3o foi poss\xEDvel registrar a sess\xE3o.");
      }
    });
    const subjectSelect = DomHelpers.createSelect(
      subjects.map((subject) => [subject.id, subject.name])
    );
    const typeSelect = DomHelpers.createSelect([
      ["pdf", "pdf"],
      ["video", "video"],
      ["questions", "questions"]
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
      DomHelpers.replaceSelectOptions(itemSelect, getItemOptions());
      DomHelpers.replaceSelectOptions(topicSelect, getTopicOptions());
    };
    const syncQuestionField = () => {
      const isQuestionSession = typeSelect.value === "questions";
      correctLabel.style.display = isQuestionSession ? "" : "none";
    };
    subjectSelect.addEventListener("change", syncDependentSelects);
    typeSelect.addEventListener("change", syncQuestionField);
    syncDependentSelects();
    syncQuestionField();
    const formGrid = DomHelpers.createElement("div", "corvo-form-grid");
    formGrid.append(
      DomHelpers.createLabel("Mat\xE9ria", subjectSelect),
      DomHelpers.createLabel("Tipo", typeSelect),
      DomHelpers.createLabel("Item", itemSelect),
      DomHelpers.createLabel("Assunto", topicSelect),
      DomHelpers.createLabel("Quantidade", countInput),
      correctLabel,
      DomHelpers.createLabel("Data", dateInput)
    );
    form.append(
      formGrid,
      DomHelpers.createButton("Cancelar", {
        type: "button",
        className: "corvo-button",
        onClick: () => {
          this.isCreatingNew = false;
          this.onUpdate();
        }
      }),
      DomHelpers.createButton("Registrar sess\xE3o", {
        type: "submit",
        className: "corvo-primary-button"
      })
    );
    card.appendChild(form);
    return card;
  }
  formatSessionType(type) {
    if (type === "questions") return "Quest\xF5es";
    if (type === "video") return "V\xEDdeo";
    return "PDF";
  }
  getDefaultDateValue() {
    const now = /* @__PURE__ */ new Date();
    const timezoneOffset = now.getTimezoneOffset() * 6e4;
    const localDate = new Date(now.getTime() - timezoneOffset);
    return localDate.toISOString().split("T")[0];
  }
  notifyError(error, fallbackMessage) {
    new import_obsidian7.Notice(error instanceof Error ? error.message : fallbackMessage);
  }
};

// src/ui/view/components/TopicsTab.ts
var import_obsidian8 = require("obsidian");

// src/application/use-cases/AddTopicResourceReferenceUseCase.ts
var AddTopicResourceReferenceUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.topicRepository = new EntityRepository(dataStore, "topics");
  }
  async execute(input) {
    const validation = new AddTopicResourceReferenceValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }
    return await this.topicRepository.update(input.topicId, (topic) => ({
      ...topic,
      resourceReferences: [...topic.resourceReferences, input.resourceReference]
    }));
  }
};

// src/application/use-cases/DeleteTopicUseCase.ts
var DeleteTopicUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.topicRepository = new EntityRepository(dataStore, "topics");
  }
  async execute(input) {
    const topic = await this.topicRepository.findById(input.topicId);
    await this.topicRepository.delete(input.topicId);
    return topic;
  }
};

// src/application/use-cases/LinkQuestionNotebookUseCase.ts
var LinkQuestionNotebookUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.topicRepository = new EntityRepository(dataStore, "topics");
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

// src/application/use-cases/UpdateTopicUseCase.ts
var UpdateTopicUseCase = class {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.topicRepository = new EntityRepository(dataStore, "topics");
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
    this.isCreatingNew = false;
    this.createTopicUseCase = new CreateTopicUseCase(dataStore);
    this.addTopicResourceReferenceUseCase = new AddTopicResourceReferenceUseCase(dataStore);
    this.linkQuestionNotebookUseCase = new LinkQuestionNotebookUseCase(dataStore);
    this.deleteTopicUseCase = new DeleteTopicUseCase(dataStore);
    this.updateTopicUseCase = new UpdateTopicUseCase(dataStore);
    this.exportToCsvUseCase = new ExportToCsvUseCase(dataStore);
  }
  async render(container, data) {
    const header = DomHelpers.createElement("div", "corvo-section-header");
    header.appendChild(DomHelpers.createSectionTitle("Assuntos e Quest\xF5es"));
    const actions = DomHelpers.createElement("div", "corvo-inline-actions");
    actions.appendChild(
      DomHelpers.createIconButton("add", "Novo assunto", {
        onClick: async () => {
          this.isCreatingNew = true;
          await this.onUpdate();
        }
      })
    );
    actions.appendChild(
      DomHelpers.createIconButton("download", "Exportar CSV", {
        onClick: async () => {
          try {
            await this.exportToCsvUseCase.execute({ entityType: "topics", subjectId: this.selectedSubjectId ?? void 0 });
          } catch (error) {
            this.notifyError(error, "N\xE3o foi poss\xEDvel exportar.");
          }
        }
      })
    );
    header.appendChild(actions);
    container.appendChild(header);
    const subject = this.getSelectedSubject(data);
    if (!subject) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Nenhuma mat\xE9ria selecionada",
          "Cadastre mat\xE9rias no concurso ativo."
        )
      );
      return;
    }
    container.appendChild(this.renderSubjectPicker(data));
    if (this.isCreatingNew) {
      container.appendChild(this.renderCreateTopicForm(subject.id));
    }
    const topics = data.topics.filter((topic) => topic.subjectId === subject.id).sort((left, right) => left.order - right.order);
    const card = DomHelpers.createCard(`Assuntos de ${subject.name}`);
    if (topics.length === 0) {
      card.appendChild(DomHelpers.createParagraph("Nenhum assunto cadastrado."));
      container.appendChild(card);
      return;
    }
    const { container: tableContainer, tbody } = DomHelpers.createCrudTable([
      "Ordem",
      "Assunto",
      "Caderno",
      "Resolv.",
      "Acert.",
      "A\xE7\xF5es"
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
    const hasDetails = topic.resourceReferences.length > 0 || topic.questionNotebook;
    tr.appendChild(DomHelpers.createCell(String(topic.order)));
    tr.appendChild(DomHelpers.createCell(topic.name));
    tr.appendChild(DomHelpers.createCell(topic.questionNotebook?.name ?? "\u2014"));
    tr.appendChild(DomHelpers.createCell(String(topic.questionNotebook?.solvedQuestions ?? 0)));
    tr.appendChild(DomHelpers.createCell(String(topic.questionNotebook?.correctAnswers ?? 0)));
    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    actions.appendChild(
      DomHelpers.createIconButton(
        this.expandedTopicId === topic.id ? "collapse" : "expand",
        this.expandedTopicId === topic.id ? "Recolher" : "Expandir",
        {
          className: `corvo-icon-button ${hasDetails ? "" : "corvo-expand-button"}`,
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
          if (confirm(`Excluir "${topic.name}"?`)) {
            try {
              await this.deleteTopicUseCase.execute({ topicId: topic.id });
              await this.onUpdate();
            } catch (error) {
              this.notifyError(error, "N\xE3o foi poss\xEDvel excluir o assunto.");
            }
          }
        }
      })
    );
    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);
    return tr;
  }
  renderEditableRow(topic, data) {
    const tr = DomHelpers.createElement("tr");
    tr.className = "corvo-editing-row";
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
          this.notifyError(error, "N\xE3o foi poss\xEDvel salvar.");
        }
      }
    });
    const cancelButton = DomHelpers.createIconButton("cancel", "Cancelar", {
      onClick: async () => {
        this.editingTopicId = null;
        await this.onUpdate();
      }
    });
    const actions = DomHelpers.createElement("div", "corvo-inline-actions corvo-inline-actions-compact");
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    tr.appendChild(DomHelpers.createCell(String(topic.order)));
    tr.appendChild(DomHelpers.createCell(null, nameInput));
    tr.appendChild(DomHelpers.createCell(null, DomHelpers.createParagraph(topic.questionNotebook?.name ?? "\u2014")));
    tr.appendChild(DomHelpers.createCell(null, solvedInput));
    tr.appendChild(DomHelpers.createCell(null, correctInput));
    const actionsCell = DomHelpers.createElement("td");
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);
    return tr;
  }
  renderDetailRow(topic, data) {
    const tr = DomHelpers.createElement("tr");
    tr.className = "corvo-detail-row";
    const td = DomHelpers.createElement("td");
    td.colSpan = 6;
    const content = DomHelpers.createElement("div", "corvo-detail-content");
    if (topic.resourceReferences.length > 0) {
      const list = DomHelpers.createElement("div", "corvo-detail-list");
      topic.resourceReferences.forEach((ref) => {
        const row = DomHelpers.createElement("div", "corvo-detail-list-item");
        row.appendChild(DomHelpers.createParagraph(`${ref.type}: ${ref.title}`));
        if (ref.url) {
          const link = DomHelpers.createElement("a");
          link.href = ref.url;
          link.textContent = "\u{1F517}";
          link.target = "_blank";
          row.appendChild(link);
        }
        list.appendChild(row);
      });
      content.appendChild(list);
    }
    const titleInput = DomHelpers.createInput("text", "T\xEDtulo");
    const typeSelect = DomHelpers.createSelect([
      ["pdf", "pdf"],
      ["video", "video"],
      ["link", "link"],
      ["question-notebook", "question-notebook"]
    ]);
    const urlInput = DomHelpers.createInput("url", "URL");
    const resourceForm = DomHelpers.createForm(async () => {
      try {
        await this.addTopicResourceReferenceUseCase.execute({
          topicId: topic.id,
          resourceReference: {
            id: `${topic.id}-resource-${Date.now()}`,
            title: titleInput.value,
            type: typeSelect.value,
            url: urlInput.value
          }
        });
        titleInput.value = "";
        urlInput.value = "";
        await this.onUpdate();
      } catch (error) {
        this.notifyError(error, "N\xE3o foi poss\xEDvel adicionar refer\xEAncia.");
      }
    });
    resourceForm.className = "corvo-detail-form";
    resourceForm.append(
      DomHelpers.createLabel("T\xEDtulo", titleInput),
      DomHelpers.createLabel("Tipo", typeSelect),
      DomHelpers.createLabel("URL", urlInput),
      DomHelpers.createIconButton("add", "Adicionar", { onClick: () => resourceForm.requestSubmit() })
    );
    content.appendChild(resourceForm);
    if (topic.questionNotebook) {
      const notebookName = DomHelpers.createInput("text", "Nome", topic.questionNotebook.name);
      const notebookSolved = DomHelpers.createInput("number", "Resolv.", String(topic.questionNotebook.solvedQuestions));
      const notebookCorrect = DomHelpers.createInput("number", "Acert.", String(topic.questionNotebook.correctAnswers));
      const notebookForm = DomHelpers.createForm(async () => {
        try {
          await this.linkQuestionNotebookUseCase.execute({
            topicId: topic.id,
            questionNotebook: {
              id: topic.questionNotebook?.id ?? `${topic.id}-notebook`,
              name: notebookName.value,
              url: topic.questionNotebook?.url ?? "",
              solvedQuestions: Number(notebookSolved.value),
              correctAnswers: Number(notebookCorrect.value)
            }
          });
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "N\xE3o foi poss\xEDvel vincular caderno.");
        }
      });
      notebookForm.className = "corvo-detail-form";
      notebookForm.append(
        DomHelpers.createLabel("Caderno", notebookName),
        DomHelpers.createLabel("Resolv.", notebookSolved),
        DomHelpers.createLabel("Acert.", notebookCorrect),
        DomHelpers.createIconButton("save", "Salvar", { onClick: () => notebookForm.requestSubmit() })
      );
      content.appendChild(notebookForm);
    }
    td.appendChild(content);
    tr.appendChild(td);
    return tr;
  }
  renderCreateTopicForm(subjectId) {
    const nameInput = DomHelpers.createInput("text", "Nome do assunto");
    const orderInput = DomHelpers.createInput("number", "Ordem", "1");
    const form = DomHelpers.createInlineForm(
      "Novo assunto",
      async () => {
        try {
          await this.createTopicUseCase.execute({
            id: `${subjectId}-topic-${Date.now()}`,
            subjectId,
            name: nameInput.value,
            order: Number(orderInput.value)
          });
          nameInput.value = "";
          orderInput.value = "1";
          this.isCreatingNew = false;
          await this.onUpdate();
        } catch (error) {
          this.notifyError(error, "N\xE3o foi poss\xEDvel criar o assunto.");
        }
      },
      () => {
        this.isCreatingNew = false;
        this.onUpdate();
      }
    );
    const innerForm = form.querySelector("form");
    innerForm.append(
      DomHelpers.createLabel("Nome", nameInput),
      DomHelpers.createLabel("Ordem", orderInput)
    );
    return form;
  }
  renderSubjectPicker(data) {
    const subjects = data.subjects.filter((subject) => subject.contestId === data.activeContestId).sort((left, right) => left.order - right.order);
    const select = DomHelpers.createSelect(
      subjects.map((subject) => [subject.id, subject.name]),
      this.selectedSubjectId ?? void 0
    );
    select.addEventListener("change", async () => {
      this.selectedSubjectId = select.value;
      await this.onUpdate();
    });
    const wrapper = DomHelpers.createElement("div", "corvo-toolbar");
    wrapper.appendChild(DomHelpers.createLabel("Mat\xE9ria", select));
    return wrapper;
  }
  getSelectedSubject(data) {
    const subjects = data.subjects.filter((subject) => subject.contestId === data.activeContestId).sort((left, right) => left.order - right.order);
    if (subjects.length === 0) return null;
    return subjects.find((subject) => subject.id === this.selectedSubjectId) ?? subjects[0];
  }
  notifyError(error, fallbackMessage) {
    new import_obsidian8.Notice(error instanceof Error ? error.message : fallbackMessage);
  }
};

// src/ui/view/components/WallTab.ts
var import_obsidian9 = require("obsidian");
var WallTab = class {
  constructor(dataStore, onUpdate) {
    this.dataStore = dataStore;
    this.onUpdate = onUpdate;
    this.updateContestWallUseCase = new UpdateContestWallUseCase(dataStore);
  }
  async render(container, data) {
    container.appendChild(DomHelpers.createSectionTitle("Mural"));
    container.appendChild(
      DomHelpers.createParagraph("Centralize os links e notas principais do concurso.")
    );
    const activeContest = data.contests.find((contest) => contest.id === data.activeContestId) ?? null;
    if (!activeContest) {
      container.appendChild(
        DomHelpers.createEmptyState(
          "Nenhum concurso ativo",
          "Selecione um concurso para editar o mural."
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
    const form = DomHelpers.createForm(async () => {
      try {
        const noticeLink = noticeUrl.value ? [
          {
            id: `${activeContest.id}-notice`,
            label: noticeLabel.value || "Edital",
            url: noticeUrl.value
          }
        ] : [];
        const examLink = examUrl.value ? [
          {
            id: `${activeContest.id}-exam`,
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
        this.notifyError(error, "N\xE3o foi poss\xEDvel salvar o mural.");
      }
    });
    form.classList.add("corvo-card");
    form.append(
      DomHelpers.createLabel("Edital", noticeLabel),
      DomHelpers.createLabel("Link do edital", noticeUrl),
      DomHelpers.createLabel("Prova", examLabel),
      DomHelpers.createLabel("Link da prova", examUrl),
      DomHelpers.createLabel("Notas", notes),
      DomHelpers.createButton("Salvar mural", {
        type: "submit",
        className: "corvo-primary-button"
      })
    );
    return form;
  }
  renderSnapshotsCard(activeContest, data) {
    const card = DomHelpers.createCard("Snapshots das mat\xE9rias");
    if (activeContest.wall.subjectSnapshots.length === 0) {
      card.appendChild(
        DomHelpers.createParagraph("Nenhum snapshot de mat\xE9ria cadastrado.")
      );
    } else {
      const subjectMap = new Map(data.subjects.map((s) => [s.id, s.name]));
      card.appendChild(
        DomHelpers.createTable(
          ["Mat\xE9ria", "Peso", "Pontua\xE7\xE3o", "Itens alvo"],
          activeContest.wall.subjectSnapshots.map((snapshot) => [
            subjectMap.get(snapshot.subjectId) ?? snapshot.subjectId,
            snapshot.weight !== void 0 ? String(snapshot.weight) : "\u2014",
            snapshot.score !== void 0 ? String(snapshot.score) : "\u2014",
            snapshot.targetItems?.join(", ") ?? "\u2014"
          ])
        )
      );
    }
    return card;
  }
  notifyError(error, fallbackMessage) {
    if (error instanceof NoActiveContestError) {
      new import_obsidian9.Notice("Nenhum concurso ativo. Selecione um concurso para continuar.");
      return;
    }
    new import_obsidian9.Notice(error instanceof Error ? error.message : fallbackMessage);
  }
};

// src/ui/view/CorvoView.ts
var TABS2 = [
  { id: "dashboard", label: "Dashboard" },
  { id: "contests", label: "Concursos" },
  { id: "cycle", label: "Ciclo e Mat\xE9rias" },
  { id: "items", label: "Itens e PDFs" },
  { id: "topics", label: "Assuntos e Quest\xF5es" },
  { id: "sessions", label: "Sess\xF5es" },
  { id: "wall", label: "Mural" }
];
var CorvoView = class extends import_obsidian10.ItemView {
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
    return CORVO_VIEW_TYPE;
  }
  getDisplayText() {
    return "Corvo";
  }
  getIcon() {
    return CORVO_ICON;
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
    this.contentEl.className = "corvo-view";
    this.shell = DomHelpers.createElement("div", "corvo-shell");
    const header = DomHelpers.createElement("header", "corvo-header");
    const titleGroup = DomHelpers.createElement("div", "corvo-title-group");
    titleGroup.append(
      DomHelpers.createHeading("Corvo"),
      DomHelpers.createParagraph("Planejamento e acompanhamento dos estudos.")
    );
    this.headerActions = DomHelpers.createElement("div", "corvo-header-actions");
    header.append(titleGroup, this.headerActions);
    this.tabBar = DomHelpers.createElement("nav", "corvo-tab-bar");
    TABS2.forEach((tab) => {
      const button = DomHelpers.createButton(tab.label, {
        dataset: { tab: tab.id },
        className: "corvo-tab-button",
        onClick: async () => {
          this.activeTab = tab.id;
          this.updateTabButtonStyles();
          await this.refresh();
        }
      });
      this.tabButtons.set(tab.id, button);
      this.tabBar.appendChild(button);
    });
    this.activeTabContainer = DomHelpers.createElement("section", "corvo-body");
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
      DomHelpers.createBadge(activeContest ? `Concurso ativo: ${activeContest.name}` : "Nenhum concurso ativo")
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
   * Updates the active class on tab buttons.
   */
  updateTabButtonStyles() {
    this.tabButtons.forEach((button, tabId) => {
      button.className = this.activeTab === tabId ? "corvo-tab-button is-active" : "corvo-tab-button";
    });
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
  getSelectedSubject(data) {
    const subjects = data.subjects.filter((subject) => subject.contestId === data.activeContestId).sort((left, right) => left.order - right.order);
    if (subjects.length === 0) {
      return null;
    }
    return subjects.find((subject) => subject.id === this.selectedSubjectId) ?? subjects[0];
  }
  ensureSelectedSubject(data) {
    const selectedSubject = this.getSelectedSubject(data);
    this.selectedSubjectId = selectedSubject?.id ?? null;
  }
};

// src/ui/view/registerCorvoView.ts
var CORVO_VIEW_TYPE = "corvo-main-view";
var CORVO_ICON = "feather";
function registerCorvoView(plugin, dataStore) {
  plugin.registerView(CORVO_VIEW_TYPE, (leaf) => new CorvoView(leaf, dataStore));
  plugin.addRibbonIcon(CORVO_ICON, "Abrir Corvo", () => openCorvoView(plugin));
  plugin.addCommand({
    id: "corvo-open-view",
    name: "Abrir painel do Corvo",
    callback: async () => {
      await openCorvoView(plugin);
    }
  });
}
async function openCorvoView(plugin) {
  const existingLeaf = plugin.app.workspace.getLeavesOfType(CORVO_VIEW_TYPE)[0];
  const leaf = existingLeaf ?? plugin.app.workspace.getLeaf();
  await leaf.setViewState({
    type: CORVO_VIEW_TYPE,
    active: true
  });
  await plugin.app.workspace.revealLeaf(leaf);
}

// src/ui/settings/CorvoSettingTab.ts
var CorvoSettingTab = class extends import_obsidian11.PluginSettingTab {
  constructor(app, corvoPlugin) {
    super(app, corvoPlugin);
    this.corvoPlugin = corvoPlugin;
  }
  display() {
    this.containerEl.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "corvo-settings";
    const title = document.createElement("h2");
    title.textContent = "Corvo";
    const description = document.createElement("p");
    description.textContent = "O Corvo \xE9 aberto em uma visualiza\xE7\xE3o pr\xF3pria dentro do Obsidian. Use o bot\xE3o abaixo para acessar o painel principal.";
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "mod-cta";
    openButton.textContent = "Abrir painel do Corvo";
    openButton.addEventListener("click", async () => {
      await openCorvoView(this.corvoPlugin);
    });
    const help = document.createElement("p");
    help.textContent = "Voc\xEA tamb\xE9m pode abrir o plugin pela faixa lateral esquerda ou pela paleta de comandos, usando o comando \u201CCorvo: Abrir painel do Corvo\u201D.";
    wrapper.append(title, description, openButton, help);
    this.containerEl.appendChild(wrapper);
  }
};

// src/main.ts
var CorvoPlugin = class extends import_obsidian12.Plugin {
  async onload() {
    this.dataStore = new PluginDataStore(new ObsidianStorageAdapter(this));
    await this.dataStore.load();
    registerCorvoView(this, this.dataStore);
    registerCommands(this, this.dataStore);
    this.addSettingTab(new CorvoSettingTab(this.app, this));
  }
};
