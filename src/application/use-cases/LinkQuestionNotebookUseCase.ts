import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { ResourceAccess } from "@/domain/entities/ResourceAccess";
import { ResourceFormat } from "@/domain/entities/Resource";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { GoalUnit } from "@/domain/types/GoalUnit";
import {
  CreateResourceUseCase,
  type CreateResourceInput
} from "@/application/use-cases/CreateResourceUseCase";

export interface LinkQuestionNotebookInput {
  topicId: string;
  subjectId: string;
  title: string;
  questionCount?: number;
  access?: ResourceAccess;
}

export class LinkQuestionNotebookUseCase {
  private readonly createResource: CreateResourceUseCase;

  constructor(dataStore: PluginDataStore, repositoryFactory?: RepositoryFactory) {
    this.createResource = new CreateResourceUseCase(dataStore, repositoryFactory);
  }

  async execute(input: LinkQuestionNotebookInput) {
    const createInput: CreateResourceInput = {
      subjectId: input.subjectId,
      title: input.title,
      format: ResourceFormat.QUESTOES,
      goal: input.questionCount
        ? new ResourceGoal(input.questionCount, GoalUnit.QUESTOES)
        : undefined,
      topicIds: [input.topicId],
      accesses: input.access ? [input.access] : []
    };
    return this.createResource.execute(createInput);
  }
}
