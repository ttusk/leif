import { describe, expect, it } from "vitest";

import { ActiveContestGuard } from "@/application/guards/ActiveContestGuard";
import { NoActiveContestError } from "@/domain/errors/DomainErrors";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import { createTestStore } from "../helpers/InMemoryStore";

describe("ActiveContestGuard", () => {
  it("requires an active contest", async () => {
    const { store } = createTestStore();
    const guard = new ActiveContestGuard(store);

    await expect(guard.requireActiveContest()).rejects.toThrow(NoActiveContestError);
  });

  it("lists active contest subjects in cycle order", async () => {
    const { store } = createTestStore({
      ...createDefaultLeifPluginData(),
      activeContestId: "contest-1",
      contests: [
        {
          id: "contest-1",
          name: "TRT",
          subjectIds: ["subject-2", "subject-1"],
          mural: { snapshots: [] }
        }
      ],
      subjects: [
        {
          id: "subject-1",
          contestId: "contest-1",
          name: "Português",
          order: 2,
          isActive: true,
          plannedStudyMinutes: 60,
          resourceIds: [],
          topicIds: []
        },
        {
          id: "subject-2",
          contestId: "contest-1",
          name: "Direito",
          order: 1,
          isActive: false,
          plannedStudyMinutes: 45,
          resourceIds: [],
          topicIds: []
        }
      ]
    });
    const guard = new ActiveContestGuard(store);

    await expect(guard.getActiveContestSubjects()).resolves.toMatchObject([
      { id: "subject-2" },
      { id: "subject-1" }
    ]);
    await expect(guard.getActiveSubjects()).resolves.toMatchObject([{ id: "subject-1" }]);
  });
});
