import { Contest } from "@/domain/entities/Contest";
import { Mural, MuralSubjectSnapshot } from "@/domain/entities/Mural";
import { ValidationError } from "@/domain/errors/DomainErrors";
import type { PluginDataStore } from "@/application/ports/PluginDataStore";
import type { RepositoryFactory } from "@/application/ports/EntityRepository";
import { UpdateContestMuralValidator } from "@/application/validation/InputValidators";

export interface MuralSnapshotInput {
  subjectId: string;
  weight?: number;
  score?: number;
  targetResources?: string[];
}

export interface UpdateContestMuralInput {
  contestId: string;
  notes?: string;
  snapshots?: MuralSnapshotInput[];
}

export class UpdateContestMuralUseCase {
  constructor(
    private readonly dataStore: PluginDataStore,
    private readonly repositoryFactory: RepositoryFactory
  ) {}

  async execute(input: UpdateContestMuralInput): Promise<Contest> {
    const validation = new UpdateContestMuralValidator().validate(input);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(", "));
    }

    const contestRepository = this.repositoryFactory.for("contests");

    return contestRepository.update(input.contestId, (contest) => {
      const notes = input.notes !== undefined ? input.notes : contest.mural.notes;
      const snapshots =
        input.snapshots !== undefined
          ? input.snapshots.map(
              (snapshot) =>
                new MuralSubjectSnapshot(
                  snapshot.subjectId,
                  snapshot.weight,
                  snapshot.score,
                  snapshot.targetResources ?? []
                )
            )
          : contest.mural.snapshots;

      return new Contest(
        contest.id,
        contest.name,
        [...contest.subjectIds],
        new Mural(notes, snapshots),
        contest.examPlan
      );
    });
  }
}
