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
import { StudySessionType } from "@/domain/entities/StudySession";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import { createId } from "@/application/Id";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";
import { seedTceSpDemo } from "@/infrastructure/persistence/Seeder";
import { t } from "@/ui/i18n";

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
    name: t("command.showActiveContest"),
    callback: async () => {
      const data = await dataStore.load();
      const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);

      new Notice(activeContest ? `Concurso escolhido: ${activeContest.name}` : "Nenhum concurso escolhido.");
    }
  });

  plugin.addCommand({
    id: "leif-seed-demo-data",
    name: t("command.seedDemoData"),
    callback: async () => {
      const data = await dataStore.load();

      if (data.contests.length > 0) {
        new Notice("O Leif já tem dados. Mantive tudo como está.");
        return;
      }

      await seedTceSpDemo(dataStore);
      new Notice("Dados de exemplo criados.");
    }
  });

  plugin.addCommand({
    id: "leif-switch-active-contest",
    name: t("command.switchActiveContest"),
    callback: async () => {
      const data = await dataStore.load();

      if (data.contests.length === 0) {
        new Notice("Cadastre pelo menos dois concursos para alternar.");
        return;
      }

      if (data.contests.length === 1 && data.activeContestId) {
        await dataStore.save({
          ...data,
          activeContestId: null
        });
        new Notice("Nenhum concurso escolhido agora.");
        return;
      }

      const currentIndex = data.contests.findIndex((contest) => contest.id === data.activeContestId);
      const nextContest = data.contests[(currentIndex + 1 + data.contests.length) % data.contests.length];

      await setActiveContest.execute({ contestId: nextContest.id });
      new Notice(`Agora estudando: ${nextContest.name}`);
    }
  });

  plugin.addCommand({
    id: "leif-show-active-subjects",
    name: t("command.showActiveContestSubjects"),
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();

      if (subjects.length === 0) {
        new Notice("Nenhuma matéria encontrada nesse concurso.");
        return;
      }

      new Notice(
        subjects
          .map((subject) => {
            const stage = subject.currentStage ?? "sem etapa";
            const state = subject.isActive ? "ativa" : "inativa";
            return `${subject.order}. ${subject.name} [${state}] ${subject.plannedStudyMinutes}m (${stage})`;
          })
          .join(" | ")
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
        new Notice("Cadastre pelo menos duas matérias para reordenar.");
        return;
      }

      await reorderSubjects.execute({
        contestId: data.activeContestId,
        subjectIdsInOrder: subjects.map((subject) => subject.id).reverse()
      });

      new Notice("Matérias reordenadas.");
    }
  });

  plugin.addCommand({
    id: "leif-toggle-first-subject-active",
    name: t("command.toggleFirstSubjectActive"),
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();
      const subject = subjects[0];

      if (!subject) {
        new Notice("Nenhuma matéria encontrada nesse concurso.");
        return;
      }

      const updatedSubject = await setSubjectActiveState.execute({
        subjectId: subject.id,
        isActive: !subject.isActive
      });

      new Notice(`${updatedSubject.name} agora está ${updatedSubject.isActive ? "ativa" : "inativa"}.`);
    }
  });

  plugin.addCommand({
    id: "leif-update-first-subject-config",
    name: t("command.updateFirstSubjectConfig"),
    callback: async () => {
      const subjects = await listSubjectsForActiveContest.execute();
      const subject = subjects[0];

      if (!subject) {
        new Notice("Nenhuma matéria encontrada nesse concurso.");
        return;
      }

      const updatedSubject = await updateSubjectConfiguration.execute({
        subjectId: subject.id,
        plannedStudyMinutes: subject.plannedStudyMinutes + 15,
        currentStage: "Revisão"
      });

      new Notice(
        `${updatedSubject.name}: ${updatedSubject.plannedStudyMinutes} min, etapa ${updatedSubject.currentStage}.`
      );
    }
  });

  plugin.addCommand({
    id: "leif-advance-cycle",
    name: t("command.advanceCycle"),
    callback: () =>
      DomHelpers.runGuarded(async () => {
        const state = await advanceCycle.execute();
        new Notice(`Matéria atual: ${state.currentSubjectId ?? "nenhuma"}`);
      }, "Não consegui avançar o ciclo.")
  });

  plugin.addCommand({
    id: "leif-show-cycle-snapshot",
    name: t("command.showCycleSnapshot"),
    callback: () =>
      DomHelpers.runGuarded(async () => {
        const snapshot = await getActiveCycleSnapshot.execute();
        const data = await dataStore.load();
        const itemMap = new Map(data.studyItems.map((item) => [item.id, item.title]));
        const currentLabel = snapshot.currentSubject?.name ?? "nenhuma";
        const nextLabel = snapshot.nextSubject?.name ?? "nenhuma";
        const currentItemLabel = snapshot.currentItemId ? itemMap.get(snapshot.currentItemId) ?? snapshot.currentItemId : "nenhum";
        const nextItemLabel = snapshot.nextItemId ? itemMap.get(snapshot.nextItemId) ?? snapshot.nextItemId : "nenhum";

        new Notice(
          `Agora: ${currentLabel} | Depois: ${nextLabel} | Item atual: ${currentItemLabel} | Próximo item: ${nextItemLabel}`
        );
      }, "Não consegui ler o ciclo.")
  });

  plugin.addCommand({
    id: "leif-show-active-contest-wall",
    name: t("command.showActiveContestWall"),
    callback: async () => {
      const data = await dataStore.load();
      const activeContest = data.contests.find((contest) => contest.id === data.activeContestId);

      if (!activeContest) {
        new Notice("Nenhum concurso escolhido.");
        return;
      }

      new Notice(
        `${activeContest.name}: ${activeContest.wall.noticeLinks.length} edital, ${activeContest.wall.examLinks.length} prova, notas: ${activeContest.wall.notes ?? "nenhuma"}`
      );
    }
  });

  plugin.addCommand({
    id: "leif-show-summary",
    name: t("command.showActiveContestSummary"),
    callback: () =>
      DomHelpers.runGuarded(async () => {
        const summary = await getActiveContestSummary.execute();

        if (summary.subjectSummaries.length === 0) {
          new Notice("Ainda não há resumo das matérias nesse concurso.");
          return;
        }

        const message = summary.subjectSummaries
          .map((subjectSummary) => {
            const accuracy =
              subjectSummary.questionAccuracy === null
                ? "sem dados"
                : `${Math.round(subjectSummary.questionAccuracy * 100)}%`;

            return `${subjectSummary.subjectName}: PDF ${subjectSummary.pdfProgressCount}, questões ${subjectSummary.questionProgressCount}, acerto ${accuracy}`;
          })
          .join(" | ");

        new Notice(message);
      }, "Não consegui carregar o resumo.")
  });

  plugin.addCommand({
    id: "leif-register-demo-question-session",
    name: t("command.registerDemoQuestionSession"),
    callback: async () => {
      const data = await dataStore.load();

      if (!data.activeContestId) {
        new Notice("Nenhum concurso escolhido.");
        return;
      }

      const contestState = data.contestStates.find((state) => state.contestId === data.activeContestId);
      const activeSubject =
        data.subjects.find((subject) => subject.id === contestState?.currentSubjectId) ??
        data.subjects.find((subject) => subject.contestId === data.activeContestId);

      if (!activeSubject) {
        new Notice("Nenhuma matéria disponível nesse concurso.");
        return;
      }

      const topic = data.topics.find((candidate) => candidate.subjectId === activeSubject.id);

      await registerStudySession.execute({
        id: createId("session-demo"),
        contestId: data.activeContestId,
        subjectId: activeSubject.id,
        topicId: topic?.id,
        type: StudySessionType.QUESTIONS,
        studiedAt: new Date().toISOString(),
        pagesOrCount: 10,
        correctAnswers: 8,
        completed: true
      });

      new Notice(`Sessão de questões criada em ${activeSubject.name}.`);
    }
  });

  plugin.addCommand({
    id: "leif-register-demo-video-session",
    name: t("command.registerDemoVideoSession"),
    callback: async () => {
      const data = await dataStore.load();

      if (!data.activeContestId) {
        new Notice("Nenhum concurso escolhido.");
        return;
      }

      const activeSubject = (await listSubjectsForActiveContest.execute())[0];

      if (!activeSubject) {
        new Notice("Nenhuma matéria disponível nesse concurso.");
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

      new Notice(`Sessão de vídeo criada em ${activeSubject.name}.`);
    }
  });

  plugin.addCommand({
    id: "leif-reset-demo-data",
    name: t("command.resetPluginData"),
    callback: async () => {
      await dataStore.save(createDefaultLeifPluginData());
      new Notice("Dados do Leif limpos.");
    }
  });
}
