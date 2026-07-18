import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import { CreateContestUseCase } from "@/application/use-cases/CreateContestUseCase";
import { CreateSubjectUseCase } from "@/application/use-cases/CreateSubjectUseCase";
import { SetActiveContestUseCase } from "@/application/use-cases/SetActiveContestUseCase";
import { EntityRepositoryFactory } from "@/infrastructure/persistence/EntityRepositoryFactory";

export async function seedMinimalContest(
  dataStore: PluginDataStore
): Promise<{ contestId: string; subjectId: string }> {
  const repositoryFactory = new EntityRepositoryFactory(dataStore);
  const createContest = new CreateContestUseCase(dataStore, repositoryFactory);
  const createSubject = new CreateSubjectUseCase(dataStore, repositoryFactory);
  const setActiveContest = new SetActiveContestUseCase(dataStore, repositoryFactory);

  const contest = await createContest.execute({ id: "contest-1", name: "TRT" });
  const subject = await createSubject.execute({
    id: "subject-1",
    contestId: contest.id,
    name: "Portuguese",
    plannedStudyMinutes: 60
  });
  await setActiveContest.execute({ contestId: contest.id });

  return { contestId: contest.id, subjectId: subject.id };
}
