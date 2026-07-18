import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { CreateTopicUseCase } from "@/application/use-cases/CreateTopicUseCase";
import { DeleteContestUseCase } from "@/application/use-cases/DeleteContestUseCase";
import { DeleteStudyItemUseCase } from "@/application/use-cases/DeleteStudyItemUseCase";
import { DeleteTopicUseCase } from "@/application/use-cases/DeleteTopicUseCase";
import { LinkQuestionNotebookUseCase } from "@/application/use-cases/LinkQuestionNotebookUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { NotFoundError } from "@/domain/errors/DomainErrors";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
import { PluginDataStore } from "@/infrastructure/persistence/PluginDataStore";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";

class InMemoryStorageAdapter implements PersistentStorageAdapter<LeifPluginData> {
  private data: LeifPluginData | null;

  constructor(initialData: LeifPluginData | null = null) {
    this.data = initialData;
  }

  async load(): Promise<LeifPluginData | null> {
    return this.data;
  }

  async save(data: LeifPluginData): Promise<void> {
    this.data = data;
  }
}

function createStore(): PluginDataStore {
  return new PluginDataStore(new InMemoryStorageAdapter(createDefaultLeifPluginData()));
}

describe("Delete cascade", () => {
  it("deleting a study item removes its id from the owning subject", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const createStudyItem = new CreateStudyItemUseCase(store, factory);
    const deleteStudyItem = new DeleteStudyItemUseCase(store, factory);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createSubject.execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Portuguese",
      plannedStudyMinutes: 60
    });
    const item = await createStudyItem.execute({ subjectId: "subject-1", title: "Sintaxe" });

    await deleteStudyItem.execute({ itemId: item.id });

    const data = await store.load();
    expect(data.studyItems).toHaveLength(0);
    expect(
      data.subjects.find((subject) => subject.id === "subject-1")?.itemIds ?? []
    ).not.toContain(item.id);
  });

  it("throws NotFoundError when deleting a nonexistent study item", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const deleteStudyItem = new DeleteStudyItemUseCase(store, factory);

    await expect(deleteStudyItem.execute({ itemId: "missing" })).rejects.toThrow(NotFoundError);
  });

  it("deleting a topic removes its id from the owning subject", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const createTopic = new CreateTopicUseCase(store, factory);
    const deleteTopic = new DeleteTopicUseCase(store, factory);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createSubject.execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Portuguese",
      plannedStudyMinutes: 60
    });
    await createTopic.execute({ id: "topic-1", subjectId: "subject-1", name: "Orações" });

    await deleteTopic.execute({ topicId: "topic-1" });

    const data = await store.load();
    expect(data.topics).toHaveLength(0);
    expect(
      data.subjects.find((subject) => subject.id === "subject-1")?.topicIds ?? []
    ).not.toContain("topic-1");
  });

  it("throws NotFoundError when deleting a nonexistent topic", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const deleteTopic = new DeleteTopicUseCase(store, factory);

    await expect(deleteTopic.execute({ topicId: "missing" })).rejects.toThrow(NotFoundError);
  });

  it("deleting a contest removes its subjects, items, topics, sessions and state", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const createStudyItem = new CreateStudyItemUseCase(store, factory);
    const createTopic = new CreateTopicUseCase(store, factory);
    const linkQuestionNotebook = new LinkQuestionNotebookUseCase(store, factory);
    const registerStudySession = new RegisterStudySessionUseCase(store, factory);
    const deleteContest = new DeleteContestUseCase(store, factory);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createContest.execute({ id: "contest-2", name: "SEFAZ" });
    await createSubject.execute({
      id: "subject-1",
      contestId: "contest-1",
      name: "Portuguese",
      plannedStudyMinutes: 60
    });
    await createStudyItem.execute({ subjectId: "subject-1", title: "Sintaxe" });
    await createTopic.execute({ id: "topic-1", subjectId: "subject-1", name: "Orações" });
    await linkQuestionNotebook.execute({
      topicId: "topic-1",
      questionNotebook: {
        id: "nb-1",
        name: "Caderno",
        url: "https://example.com",
        solvedQuestions: 0,
        correctAnswers: 0
      }
    });
    await registerStudySession.execute({
      id: "session-1",
      contestId: "contest-1",
      subjectId: "subject-1",
      type: "questions",
      studiedAt: "2026-06-11",
      pagesOrCount: 10,
      correctAnswers: 8,
      completed: true
    });

    await deleteContest.execute({ contestId: "contest-1" });

    const data = await store.load();
    expect(data.contests.map((contest) => contest.id)).toEqual(["contest-2"]);
    expect(data.contestStates.map((state) => state.contestId)).toEqual(["contest-2"]);
    expect(data.subjects).toHaveLength(0);
    expect(data.studyItems).toHaveLength(0);
    expect(data.topics).toHaveLength(0);
    expect(data.studySessions).toHaveLength(0);
    expect(data.activeContestId).toBeNull();
  });

  it("deleting a non-active contest leaves the active contest and its data untouched", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const deleteContest = new DeleteContestUseCase(store, factory);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createContest.execute({ id: "contest-2", name: "SEFAZ" });
    await createSubject.execute({
      id: "subject-1",
      contestId: "contest-2",
      name: "Tax",
      plannedStudyMinutes: 45
    });

    await deleteContest.execute({ contestId: "contest-2" });

    const data = await store.load();
    expect(data.activeContestId).toBe("contest-1");
    expect(data.contests.map((contest) => contest.id)).toEqual(["contest-1"]);
    expect(data.subjects).toHaveLength(0);
  });

  it("throws NotFoundError when deleting a nonexistent contest", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const deleteContest = new DeleteContestUseCase(store, factory);

    await expect(deleteContest.execute({ contestId: "missing" })).rejects.toThrow(NotFoundError);
  });
});
