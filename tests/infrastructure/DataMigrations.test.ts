import { describe, expect, it } from "vitest";

import { GoalUnit } from "@/domain/types/GoalUnit";
import {
  LEIF_DATA_SCHEMA_VERSION,
  createDefaultLeifPluginData
} from "@/domain/types/LeifPluginData";
import { DataMigrationService } from "@/infrastructure/persistence/DataMigrations";

describe("DataMigrationService", () => {
  const service = new DataMigrationService();

  it("reports and stamps the current schema version", () => {
    expect(service.getCurrentVersion()).toBe(LEIF_DATA_SCHEMA_VERSION);
    expect(service.migrate(createDefaultLeifPluginData()).schemaVersion).toBe(
      LEIF_DATA_SCHEMA_VERSION
    );
  });

  it("refuses to downgrade data created by a newer Leif schema", () => {
    const futureData = { ...createDefaultLeifPluginData(), schemaVersion: 99 };

    expect(() => service.migrate(futureData)).toThrow(/newer Leif version/i);
    expect(futureData.schemaVersion).toBe(99);
  });

  it("projects legacy contests, wall notes and subject order into schema 3", () => {
    const migrated = service.migrate({
      ...createDefaultLeifPluginData(),
      schemaVersion: 1,
      contests: [
        {
          id: "contest-1",
          name: "TRT",
          subjectIds: ["subject-2", "subject-1"],
          wall: {
            notes: "Edital publicado",
            noticeLinks: [{ title: "Edital", url: "https://example.com/edital" }],
            examLinks: [],
            subjectSnapshots: [
              { subjectId: "subject-1", weight: 2, score: 80, targetItems: ["item-1"] }
            ]
          }
        }
      ] as never,
      subjects: [
        {
          id: "subject-2",
          contestId: "contest-1",
          name: "Direito",
          order: 1,
          itemIds: [],
          topicIds: []
        },
        {
          id: "subject-1",
          contestId: "contest-1",
          name: "Português",
          order: 0,
          itemIds: ["item-1"],
          topicIds: []
        }
      ] as never
    });

    expect(migrated.contests[0].mural.notes).toContain("Edital publicado");
    expect(migrated.contests[0].mural.notes).toContain("[Edital](https://example.com/edital)");
    expect(migrated.contests[0].mural.snapshots[0]).toMatchObject({
      subjectId: "subject-1",
      targetResources: ["item-1"]
    });
    expect(
      migrated.subjects
        .map(({ id, order }) => [id, order])
        .sort((left, right) => Number(left[1]) - Number(right[1]))
    ).toEqual([
      ["subject-1", 1],
      ["subject-2", 2]
    ]);
    expect(migrated.subjects.find((subject) => subject.id === "subject-1")?.resourceIds).toEqual([
      "item-1"
    ]);
  });

  it("projects legacy study items into resources with goals and accesses", () => {
    const migrated = service.migrate({
      ...createDefaultLeifPluginData(),
      schemaVersion: 1,
      subjects: [
        {
          id: "subject-1",
          contestId: "contest-1",
          name: "Português",
          order: 0,
          itemIds: ["item-1"],
          topicIds: []
        }
      ] as never,
      studyItems: [
        {
          id: "item-1",
          subjectId: "subject-1",
          title: "PDF 01",
          order: 0,
          totalPages: 120,
          resourceReferences: [{ title: "Arquivo", url: "vault://pdf-01" }]
        }
      ] as never
    } as never);

    expect(migrated.resources[0]).toMatchObject({
      id: "item-1",
      format: "pdf",
      goal: { amount: 120, unit: GoalUnit.PAGINAS },
      accesses: [{ title: "Arquivo", url: "vault://pdf-01" }]
    });
  });

  it("keeps a legacy resource format but omits a zero-valued goal", () => {
    const migrated = service.migrate({
      ...createDefaultLeifPluginData(),
      schemaVersion: 1,
      studyItems: [
        {
          id: "item-without-known-length",
          subjectId: "subject-1",
          title: "PDF sem total informado",
          order: 1,
          totalPages: 0
        }
      ] as never
    } as never);

    expect(migrated.resources[0]).toMatchObject({
      id: "item-without-known-length",
      format: "pdf",
      goal: undefined
    });
  });

  it("projects old flat study sessions into one-record session aggregates", () => {
    const migrated = service.migrate({
      ...createDefaultLeifPluginData(),
      schemaVersion: 1,
      studySessions: [
        {
          id: "old-session-1",
          contestId: "contest-1",
          subjectId: "subject-1",
          studyItemId: "item-1",
          type: "pdf",
          studiedAt: "2026-07-27T19:00:00.000Z",
          pagesOrCount: 30,
          phase: "Teoria"
        }
      ] as never
    });

    expect(migrated.studySessions).toHaveLength(1);
    expect(migrated.studySessions[0]).toMatchObject({
      contestId: "contest-1",
      date: "2026-07-27",
      records: [
        {
          id: "old-session-1",
          subjectId: "subject-1",
          activity: "leitura",
          resourceId: "item-1",
          quantity: 30,
          unit: GoalUnit.PAGINAS,
          notes: "Fase: Teoria"
        }
      ]
    });
  });

  it("is idempotent for schema-3 data", () => {
    const data = createDefaultLeifPluginData();
    const once = service.migrate(data);
    const twice = service.migrate(once);
    expect(twice).toEqual(once);
  });
});
