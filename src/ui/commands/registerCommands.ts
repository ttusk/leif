import type { Plugin } from "obsidian";
import { Notice } from "obsidian";

import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { DomHelpers } from "@/ui/view/shared/DomHelpers";
import { AdvanceCycleUseCase } from "@/application/use-cases/AdvanceCycleUseCase";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateStudyItemUseCase } from "@/application/use-cases/CreateStudyItemUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { CreateTopicUseCase } from "@/application/use-cases/CreateTopicUseCase";
import { GetActiveContestSummaryUseCase } from "@/application/use-cases/GetActiveContestSummaryUseCase";
import { GetActiveCycleSnapshotUseCase } from "@/application/use-cases/GetActiveCycleSnapshotUseCase";
import { ListSubjectsForActiveContestUseCase } from "@/application/use-cases/ListSubjectsForActiveContestUseCase";
import { ReorderSubjectsUseCase } from "@/application/use-cases/ReorderSubjectsUseCase";
import { RegisterStudySessionUseCase } from "@/application/use-cases/RegisterStudySessionUseCase";
import { SetSubjectActiveStateUseCase } from "@/application/use-cases/SetSubjectActiveStateUseCase";
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import { UpdateContestWallUseCase } from "@/application/use-cases/UpdateContestWallUseCase";
import { UpdateSubjectConfigurationUseCase } from "@/application/use-cases/UpdateSubjectConfigurationUseCase";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import { createId } from "@/application/Id";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { seedTceSpDemo } from "@/infrastructure/persistence/Seeder";

export function registerCommands(plugin: Plugin, dataStore: PluginDataStore): void {
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
    name: "Show active contest",
    callback: async () => {
      const data = await dataStore.load();
      const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);

      new Notice(activeContest ? `Active contest: ${activeContest.name}` : "No active contest configured.");
    }
  });

  plugin.addCommand({
    id: "leif-seed-demo-data",
    name: "Seed demo data",
    callback: async () => {
      const data = await dataStore.load();

      if (data.contests.length > 0) {
        new Notice("Leif already has data. Demo seed skipped.");
        return;
      }

      await seedTceSpDemo(dataStore);
      new Notice("Leif demo data created.");
    }
  });

  plugin.addCommand({
    id: "leif-switch-active-contest",
    name: "Switch active contest",
    callback: async () => {
      const data = await dataStore.load();

      if (data.contests.length === 0) {
        new Notice("At least two contests are required to switch the active contest.");
        return;
      }

      if (data.contests.length === 1 && data.activeContestId) {
        await dataStore.save({
          ...data,
          activeContestId: null
        });
        new Notice("Active contest switched to: none");
        return;
      }

      const currentIndex = data.contests.findIndex((contest) => contest.id === data.activeContestId);
      const nextContest = data.contests[(currentIndex + 1 + data.contests.length) % data.contests.length];

      await setActiveContest.execute({ contestId: nextContest.id });
      new Notice(`Active contest switched to: ${nextContest.name}`);
    }
  });

  plugin.addCommand({
    id: "leif-show-active-subjects",
    name: "Show active contest subjects",
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();

      if (subjects.length === 0) {
        new Notice("No subjects found for the active contest.");
        return;
      }

      new Notice(
        subjects
          .map((subject) => {
            const stage = subject.currentStage ?? "no stage";
            const state = subject.isActive ? "active" : "inactive";
            return `${subject.order}. ${subject.name} [${state}] ${subject.plannedStudyMinutes}m (${stage})`;
          })
          .join(" | ")
      );
    }
  });

  plugin.addCommand({
    id: "leif-reorder-active-subjects",
    name: "Reorder active contest subjects",
    callback: async () => {
      const data = await dataStore.load();
      const subjects = await listSubjectsForActiveContest.execute();

      if (!data.activeContestId || subjects.length < 2) {
        new Notice("At least two subjects are required to reorder the active contest.");
        return;
      }

      await reorderSubjects.execute({
        contestId: data.activeContestId,
        subjectIdsInOrder: subjects.map((subject) => subject.id).reverse()
      });

      new Notice("Active contest subjects reordered.");
    }
  });

  plugin.addCommand({
    id: "leif-toggle-first-subject-active",
    name: "Toggle first subject active state",
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();
      const subject = subjects[0];

      if (!subject) {
        new Notice("No subject found for the active contest.");
        return;
      }

      const updatedSubject = await setSubjectActiveState.execute({
        subjectId: subject.id,
        isActive: !subject.isActive
      });

      new Notice(`Subject ${updatedSubject.name} is now ${updatedSubject.isActive ? "active" : "inactive"}.`);
    }
  });

  plugin.addCommand({
    id: "leif-update-first-subject-config",
    name: "Update first subject configuration",
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();
      const subject = subjects[0];

      if (!subject) {
        new Notice("No subject found for the active contest.");
        return;
      }

      const updatedSubject = await updateSubjectConfiguration.execute({
        subjectId: subject.id,
        plannedStudyMinutes: subject.plannedStudyMinutes + 15,
        currentStage: "Review"
      });

      new Notice(
        `Subject ${updatedSubject.name} updated to ${updatedSubject.plannedStudyMinutes} minutes and stage ${updatedSubject.currentStage}.`
      );
    }
  });

  plugin.addCommand({
    id: "leif-advance-cycle",
    name: "Advance cycle",
    callback: () =>
      DomHelpers.runGuarded(async () => {
        const state = await advanceCycle.execute();
        new Notice(`Current subject: ${state.currentSubjectId ?? "none"}`);
      }, "Could not advance cycle.")
  });

  plugin.addCommand({
    id: "leif-show-cycle-snapshot",
    name: "Show cycle snapshot",
    callback: () =>
      DomHelpers.runGuarded(async () => {
        const snapshot = await getActiveCycleSnapshot.execute();
        const data = await dataStore.load();
        const itemMap = new Map(data.studyItems.map((item) => [item.id, item.title]));
        const currentLabel = snapshot.currentSubject?.name ?? "none";
        const nextLabel = snapshot.nextSubject?.name ?? "none";
        const currentItemLabel = snapshot.currentItemId ? itemMap.get(snapshot.currentItemId) ?? snapshot.currentItemId : "none";
        const nextItemLabel = snapshot.nextItemId ? itemMap.get(snapshot.nextItemId) ?? snapshot.nextItemId : "none";

        new Notice(
          `Current: ${currentLabel} | Next: ${nextLabel} | Current item: ${currentItemLabel} | Next item: ${nextItemLabel}`
        );
      }, "Could not read cycle snapshot.")
  });

  plugin.addCommand({
    id: "leif-show-active-contest-wall",
    name: "Show active contest wall",
    callback: async () => {
      const data = await dataStore.load();
      const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);

      if (!activeContest) {
        new Notice("No active contest configured.");
        return;
      }

      new Notice(
        `${activeContest.name}: notices ${activeContest.wall.noticeLinks.length}, exams ${activeContest.wall.examLinks.length}, notes ${activeContest.wall.notes ?? "none"}`
      );
    }
  });

  plugin.addCommand({
    id: "leif-show-summary",
    name: "Show active contest summary",
    callback: () =>
      DomHelpers.runGuarded(async () => {
        const summary = await getActiveContestSummary.execute();

        if (summary.subjectSummaries.length === 0) {
          new Notice("No subject summary available for the active contest.");
          return;
        }

        const message = summary.subjectSummaries
          .map((subjectSummary) => {
            const accuracy =
              subjectSummary.questionAccuracy === null
                ? "n/a"
                : `${Math.round(subjectSummary.questionAccuracy * 100)}%`;

            return `${subjectSummary.subjectName}: PDF ${subjectSummary.pdfProgressCount}, Questions ${subjectSummary.questionProgressCount}, Accuracy ${accuracy}`;
          })
          .join(" | ");

        new Notice(message);
      }, "Could not load active contest summary.")
  });

  plugin.addCommand({
    id: "leif-register-demo-question-session",
    name: "Register demo question session",
    callback: async () => {
      const data = await dataStore.load();

      if (!data.activeContestId) {
        new Notice("No active contest configured.");
        return;
      }

      const contestState = data.contestStates.find((state) => state.contestId === data.activeContestId);
      const activeSubject =
        data.subjects.find((subject) => subject.id === contestState?.currentSubjectId) ??
        data.subjects.find((subject) => subject.contestId === data.activeContestId);

      if (!activeSubject) {
        new Notice("No subject available for the active contest.");
        return;
      }

      const topic = data.topics.find((candidate) => candidate.subjectId === activeSubject.id);

      await registerStudySession.execute({
        id: createId("session-demo"),
        contestId: data.activeContestId,
        subjectId: activeSubject.id,
        topicId: topic?.id,
        type: "questions",
        studiedAt: new Date().toISOString(),
        pagesOrCount: 10,
        correctAnswers: 8,
        completed: true
      });

      new Notice(`Demo question session registered for: ${activeSubject.name}`);
    }
  });

  plugin.addCommand({
    id: "leif-register-demo-video-session",
    name: "Register demo video session",
    callback: async () => {
      const data = await dataStore.load();

      if (!data.activeContestId) {
        new Notice("No active contest configured.");
        return;
      }

      const activeSubject = (await listSubjectsForActiveContest.execute())[0];

      if (!activeSubject) {
        new Notice("No subject available for the active contest.");
        return;
      }

      await registerStudySession.execute({
        id: createId("session-video"),
        contestId: data.activeContestId,
        subjectId: activeSubject.id,
        type: "video",
        studiedAt: new Date().toISOString(),
        pagesOrCount: 1,
        completed: true
      });

      new Notice(`Demo video session registered for: ${activeSubject.name}`);
    }
  });

  plugin.addCommand({
    id: "leif-reset-demo-data",
    name: "Reset plugin data",
    callback: async () => {
      await dataStore.save(createDefaultLeifPluginData());
      new Notice("Leif data reset.");
    }
  });
}
