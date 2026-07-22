import { describe, expect, it } from "vitest";

import {
  MigrationBlockedError,
  MigrationSafetyService
} from "@/application/services/MigrationSafetyService";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";

function buildLegacyData(): LeifPluginData {
  return {
    ...createDefaultLeifPluginData(),
    activeContestId: "contest-1",
    contests: [
      {
        id: "contest-1",
        name: "ABGF",
        subjectIds: ["subject-1"],
        wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
      }
    ],
    contestStates: [
      { contestId: "contest-1", currentSubjectId: "subject-1", currentItemId: "item-1" }
    ],
    subjects: [
      {
        id: "subject-1",
        contestId: "contest-1",
        name: "Português",
        order: 1,
        isActive: true,
        plannedStudyMinutes: 60,
        itemIds: ["item-1"],
        topicIds: ["topic-1"]
      }
    ],
    studyItems: [{ id: "item-1", subjectId: "subject-1", title: "Sintaxe", order: 1 }],
    topics: [
      {
        id: "topic-1",
        subjectId: "subject-1",
        name: "Orações",
        resourceReferences: []
      }
    ],
    studySessions: [
      {
        id: "session-1",
        contestId: "contest-1",
        type: "questions",
        studiedAt: "2026-07-21T20:00:00.000Z",
        subjectId: "subject-1",
        studyItemId: "item-1",
        topicId: "topic-1",
        pagesOrCount: 20,
        correctAnswers: 16
      }
    ]
  };
}

describe("MigrationSafetyService", () => {
  it("blocks migration when raw legacy data contains duplicate identities or orphans", async () => {
    const service = new MigrationSafetyService();
    const data = buildLegacyData();
    data.subjects.push({ ...data.subjects[0] });
    data.studyItems.push({ id: "orphan-item", subjectId: "missing", title: "Órfão", order: 1 });

    await expect(
      service.prepare(data, "contest-1", "Leif/backups/contest-1.json", "2026-07-21T20:00:00.000Z")
    ).rejects.toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "duplicate-id", entityId: "subject-1" }),
        expect.objectContaining({ code: "orphan-study-item", entityId: "orphan-item" })
      ])
    });
  });

  it("records an immutable backup checksum before a migration can be verified", async () => {
    const service = new MigrationSafetyService();

    const prepared = await service.prepare(
      buildLegacyData(),
      "contest-1",
      "Leif/backups/contest-1.json",
      "2026-07-21T20:00:00.000Z"
    );

    expect(prepared.receipt.status).toBe("backed-up");
    expect(prepared.receipt.backupPath).toBe("Leif/backups/contest-1.json");
    expect(prepared.receipt.backupChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(prepared.backupContent).toContain('"contest-1"');
  });

  it("activates Markdown authority only after semantic verification succeeds", async () => {
    const service = new MigrationSafetyService();
    const data = buildLegacyData();
    const prepared = await service.prepare(
      data,
      "contest-1",
      "Leif/backups/contest-1.json",
      "2026-07-21T20:00:00.000Z"
    );

    const verified = await service.verify(prepared.receipt, data, structuredClone(data));
    expect(verified.status).toBe("verified");

    const changedProjection = structuredClone(data);
    changedProjection.subjects[0] = {
      ...changedProjection.subjects[0],
      name: "Nome divergente"
    };
    await expect(service.verify(prepared.receipt, data, changedProjection)).rejects.toThrow(
      MigrationBlockedError
    );
  });
});
