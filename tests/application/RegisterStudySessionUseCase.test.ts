import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { CreateTopicUseCase } from "@/application/use-cases/CreateTopicUseCase";
import { LinkQuestionNotebookUseCase } from "@/application/use-cases/LinkQuestionNotebookUseCase";
import { ValidationError } from "@/domain/errors/DomainErrors";
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

async function seedContestSubjectTopic(store: PluginDataStore): Promise<void> {
  const factory = new EntityRepositoryFactory(store);
  const createContest = new CreateContestUseCase(store, factory);
  const createSubject = new CreateSubjectUseCase(store, factory);
  const createTopic = new CreateTopicUseCase(store, factory);
  const linkNotebook = new LinkQuestionNotebookUseCase(store, factory);

  await createContest.execute({ id: "contest-1", name: "TRT" });
  await createSubject.execute({
    id: "subject-1",
    contestId: "contest-1",
    name: "Portuguese",
    plannedStudyMinutes: 60
  });
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
}

describe("RegisterStudySessionUseCase", () => {
  it("creates a pdf session without question fields", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    await seedContestSubjectTopic(store);
    const useCase = new RegisterStudySessionUseCase(store, factory);

    const session = await useCase.execute({
      id: "session-pdf-1",
      contestId: "contest-1",
      subjectId: "subject-1",
      topicId: "topic-1",
      type: "pdf",
      studiedAt: "2026-06-11T20:00:00.000Z",
      pagesOrCount: 12,
      completed: true
    });

    expect(session).toMatchObject({
      id: "session-pdf-1",
      type: "pdf",
      pagesOrCount: 12
    });
  });

  it("rejects a session whose correctAnswers exceed pagesOrCount", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    await seedContestSubjectTopic(store);
    const useCase = new RegisterStudySessionUseCase(store, factory);

    await expect(
      useCase.execute({
        id: "session-bad-1",
        contestId: "contest-1",
        subjectId: "subject-1",
        topicId: "topic-1",
        type: "questions",
        studiedAt: "2026-06-11T20:00:00.000Z",
        pagesOrCount: 5,
        correctAnswers: 9,
        completed: true
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a questions session with zero questions in the use case", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    await seedContestSubjectTopic(store);
    const useCase = new RegisterStudySessionUseCase(store, factory);

    await expect(
      useCase.execute({
        id: "session-zero-questions",
        contestId: "contest-1",
        subjectId: "subject-1",
        topicId: "topic-1",
        type: "questions",
        studiedAt: "2026-06-11T20:00:00.000Z",
        pagesOrCount: 0,
        correctAnswers: 0,
        completed: true
      })
    ).rejects.toThrow("Questions count must be greater than zero");
  });

  it("creates a questions session and increments the topic's question-notebook stats", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    await seedContestSubjectTopic(store);
    const useCase = new RegisterStudySessionUseCase(store, factory);

    await useCase.execute({
      id: "session-q-1",
      contestId: "contest-1",
      subjectId: "subject-1",
      topicId: "topic-1",
      type: "questions",
      studiedAt: "2026-06-11T20:00:00.000Z",
      pagesOrCount: 20,
      correctAnswers: 15,
      completed: true
    });

    const data = await store.load();
    const topic = data.topics.find((t) => t.id === "topic-1");

    expect(topic?.questionNotebook).toMatchObject({
      solvedQuestions: 20,
      correctAnswers: 15
    });
  });
});
