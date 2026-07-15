import { describe, expect, it } from "vitest";

import type { PersistentStorageAdapter } from "@/application/ports/PersistentStorageAdapter";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { GetActiveContestProgressDashboardUseCase } from "@/application/use-cases/GetActiveContestProgressDashboardUseCase";
import { GetActiveContestSummaryUseCase } from "@/application/use-cases/GetActiveContestSummaryUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { UpdateContestWallUseCase } from "@/application/use-cases/UpdateContestWallUseCase";
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

describe("Contest wall and summary", () => {
  it("updates the wall for a contest", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const updateContestWall = new UpdateContestWallUseCase(store, factory);

    await createContest.execute({ id: "contest-1", name: "TRT" });

    await updateContestWall.execute({
      contestId: "contest-1",
      wall: {
        noticeLinks: [{ id: "notice-1", label: "Edital", url: "https://example.com/edital" }],
        examLinks: [{ id: "exam-1", label: "Prova anterior", url: "https://example.com/prova" }],
        subjectSnapshots: [{ subjectId: "subject-1", weight: 2, score: 10, targetItems: ["item-1"] }],
        notes: "Priorizar português e constitucional."
      }
    });

    const data = await store.load();

    expect(data.contests).toMatchObject([
      {
        id: "contest-1",
        wall: {
          noticeLinks: [{ id: "notice-1", label: "Edital" }],
          examLinks: [{ id: "exam-1", label: "Prova anterior" }],
          notes: "Priorizar português e constitucional."
        }
      }
    ]);
  });

  it("rejects invalid wall URLs before saving", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const updateContestWall = new UpdateContestWallUseCase(store, factory);

    await createContest.execute({ id: "contest-1", name: "TRT" });

    await expect(
      updateContestWall.execute({
        contestId: "contest-1",
        wall: {
          noticeLinks: [{ id: "notice-1", label: "Edital", url: "not a url" }],
          examLinks: [],
          subjectSnapshots: [],
          notes: ""
        }
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("caps accuracy at 100% even when raw ratio exceeds 1", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const getSummary = new GetActiveContestSummaryUseCase(store);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createSubject.execute({ id: "subject-1", contestId: "contest-1", name: "Portuguese", plannedStudyMinutes: 60 });

    // Inject corrupted legacy data directly (correctAnswers > pagesOrCount)
    const data = await store.load();
    data.studySessions.push({
      id: "session-bad",
      contestId: "contest-1",
      subjectId: "subject-1",
      type: "questions",
      studiedAt: "2026-06-11T20:00:00.000Z",
      pagesOrCount: 10,
      correctAnswers: 11,
      completed: true
    } as any);
    await store.save(data);

    const summary = await getSummary.execute();
    expect(summary.subjectSummaries[0].questionAccuracy).toBe(1);
  });

  it("ignores pdf and video sessions when calculating question accuracy", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const registerStudySession = new RegisterStudySessionUseCase(store, factory);
    const getSummary = new GetActiveContestSummaryUseCase(store);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createSubject.execute({ id: "subject-1", contestId: "contest-1", name: "Portuguese", plannedStudyMinutes: 60 });

    await registerStudySession.execute({
      id: "session-pdf",
      contestId: "contest-1",
      subjectId: "subject-1",
      type: "pdf",
      studiedAt: "2026-06-11T20:00:00.000Z",
      pagesOrCount: 100,
      completed: true
    });

    await registerStudySession.execute({
      id: "session-video",
      contestId: "contest-1",
      subjectId: "subject-1",
      type: "video",
      studiedAt: "2026-06-11T21:00:00.000Z",
      pagesOrCount: 1,
      completed: true
    });

    await registerStudySession.execute({
      id: "session-questions",
      contestId: "contest-1",
      subjectId: "subject-1",
      type: "questions",
      studiedAt: "2026-06-11T22:00:00.000Z",
      pagesOrCount: 20,
      correctAnswers: 15,
      completed: true
    });

    const summary = await getSummary.execute();
    const subjectSummary = summary.subjectSummaries[0];

    expect(subjectSummary.pdfProgressCount).toBe(100);
    expect(subjectSummary.questionProgressCount).toBe(20);
    expect(subjectSummary.questionAccuracy).toBe(0.75);
  });

  it("consolidates summary and progress by subject for the active contest", async () => {
    const store = createStore();
    const factory = new EntityRepositoryFactory(store);
    const createContest = new CreateContestUseCase(store, factory);
    const createStudyItem = new CreateStudyItemUseCase(store, factory);
    const createSubject = new CreateSubjectUseCase(store, factory);
    const registerStudySession = new RegisterStudySessionUseCase(store, factory);
    const getSummary = new GetActiveContestSummaryUseCase(store);
    const getProgressDashboard = new GetActiveContestProgressDashboardUseCase(store);

    await createContest.execute({ id: "contest-1", name: "TRT" });
    await createSubject.execute({ id: "subject-1", contestId: "contest-1", name: "Portuguese", plannedStudyMinutes: 60 });
    await createSubject.execute({ id: "subject-2", contestId: "contest-1", name: "Constitutional Law", plannedStudyMinutes: 45 });
    const item1 = await createStudyItem.execute({ subjectId: "subject-1", title: "Sintaxe", weight: 2, questionCount: 30 });
    await createStudyItem.execute({ subjectId: "subject-1", title: "Pontuação", weight: 1, questionCount: 20 });

    await registerStudySession.execute({
      id: "session-1",
      contestId: "contest-1",
      subjectId: "subject-1",
      studyItemId: item1.id,
      type: "pdf",
      studiedAt: "2026-06-11T20:00:00.000Z",
      pagesOrCount: 30,
      completed: true
    });
    await registerStudySession.execute({
      id: "session-2",
      contestId: "contest-1",
      subjectId: "subject-1",
      type: "questions",
      studiedAt: "2026-06-11T21:00:00.000Z",
      pagesOrCount: 20,
      correctAnswers: 16,
      completed: true
    });
    await registerStudySession.execute({
      id: "session-3",
      contestId: "contest-1",
      subjectId: "subject-2",
      type: "questions",
      studiedAt: "2026-06-12T22:00:00.000Z",
      pagesOrCount: 10,
      correctAnswers: 7,
      completed: true
    });

    await expect(getSummary.execute()).resolves.toMatchObject({
      contestId: "contest-1",
      subjectSummaries: [
        {
          subjectId: "subject-1",
          totalSessions: 2,
          pdfProgressCount: 30,
          questionProgressCount: 20,
          questionAccuracy: 0.8
        },
        {
          subjectId: "subject-2",
          totalSessions: 1,
          pdfProgressCount: 0,
          questionProgressCount: 10,
          questionAccuracy: 0.7
        }
      ]
    });
    const progressDashboard = await getProgressDashboard.execute();
    expect(progressDashboard).toMatchObject({
      contestId: "contest-1",
      pdfProgressBySubject: [
        {
          subjectId: "subject-1",
          subjectName: "Portuguese",
          totalProgressCount: 30,
          items: [
            {
              title: "Sintaxe",
              order: 1,
              progressCount: 30,
              weight: 2,
              questionCount: 30
            },
            {
              title: "Pontuação",
              order: 2,
              progressCount: 0,
              weight: 1,
              questionCount: 20
            }
          ]
        },
        {
          subjectId: "subject-2",
          subjectName: "Constitutional Law",
          totalProgressCount: 0,
          items: []
        }
      ],
      questionProgressBySubject: [
        {
          subjectId: "subject-1",
          points: [
            {
              date: "2026-06-11",
              questionCount: 20,
              correctAnswers: 16,
              accuracy: 0.8
            }
          ]
        },
        {
          subjectId: "subject-2",
          points: [
            {
              date: "2026-06-12",
              questionCount: 10,
              correctAnswers: 7,
              accuracy: 0.7
            }
          ]
        }
      ]
    });
  });
});
