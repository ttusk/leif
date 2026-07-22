import { describe, expect, it } from "vitest";

import { DataMigrationService } from "@/infrastructure/persistence/DataMigrations";
import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";

describe("DataMigrationService", () => {
  const service = new DataMigrationService();

  it("reports the current schema version", () => {
    expect(service.getCurrentVersion()).toBe(1);
  });

  it("stamps the data with the current schema version", () => {
    const migrated = service.migrate({ ...createDefaultLeifPluginData() });
    expect(migrated.schemaVersion).toBe(1);
  });

  it("preserves duplicate entities for explicit repair instead of silently deleting data", () => {
    const base = createDefaultLeifPluginData();
    const subject = {
      id: "subject-1",
      contestId: "c1",
      name: "Portuguese",
      order: 1,
      isActive: true,
      plannedStudyMinutes: 60,
      itemIds: [],
      topicIds: []
    };
    const data: LeifPluginData = {
      ...base,
      subjects: [subject, { ...subject, name: "Duplicate" }]
    };

    const migrated = service.migrate({ ...data, schemaVersion: 1 });

    expect(migrated.subjects).toHaveLength(2);
    expect(migrated.subjects[0].name).toBe("Portuguese");
    expect(migrated.subjects[1].name).toBe("Duplicate");
  });

  it("preserves duplicate relationship entries for explicit repair", () => {
    const base = createDefaultLeifPluginData();
    const data: LeifPluginData = {
      ...base,
      contests: [
        {
          id: "c1",
          name: "TRT",
          subjectIds: ["s1", "s1", "s2", "s1"],
          wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
        }
      ]
    };

    const migrated = service.migrate({ ...data, schemaVersion: 1 });

    expect(migrated.contests[0].subjectIds).toEqual(["s1", "s1", "s2", "s1"]);
  });

  it("refuses to downgrade data created by a newer Leif schema", () => {
    const futureData = { ...createDefaultLeifPluginData(), schemaVersion: 99 };

    expect(() => service.migrate(futureData)).toThrow(/newer Leif version/i);
    expect(futureData.schemaVersion).toBe(99);
  });

  it("normalizes subject and study item order to one-based sequences per parent", () => {
    const base = createDefaultLeifPluginData();
    const data: LeifPluginData = {
      ...base,
      subjects: [
        {
          id: "subject-second",
          contestId: "contest-1",
          name: "Second",
          order: 1,
          isActive: true,
          plannedStudyMinutes: 60,
          itemIds: [],
          topicIds: []
        },
        {
          id: "subject-first",
          contestId: "contest-1",
          name: "First",
          order: 0,
          isActive: true,
          plannedStudyMinutes: 60,
          itemIds: [],
          topicIds: []
        },
        {
          id: "other-contest-subject",
          contestId: "contest-2",
          name: "Other",
          order: 0,
          isActive: true,
          plannedStudyMinutes: 60,
          itemIds: [],
          topicIds: []
        }
      ],
      studyItems: [
        {
          id: "item-second",
          subjectId: "subject-first",
          title: "Second item",
          order: 1
        },
        {
          id: "item-first",
          subjectId: "subject-first",
          title: "First item",
          order: 0
        }
      ]
    };

    const migrated = service.migrate(data);
    const subjectOrders = new Map(migrated.subjects.map((subject) => [subject.id, subject.order]));
    const itemOrders = new Map(migrated.studyItems.map((item) => [item.id, item.order]));

    expect(subjectOrders).toEqual(
      new Map([
        ["subject-first", 1],
        ["subject-second", 2],
        ["other-contest-subject", 1]
      ])
    );
    expect(itemOrders).toEqual(
      new Map([
        ["item-first", 1],
        ["item-second", 2]
      ])
    );
  });

  it("is idempotent", () => {
    const data = { ...createDefaultLeifPluginData(), schemaVersion: 1 };
    const once = service.migrate(data);
    const twice = service.migrate(once);
    expect(twice).toEqual(once);
  });
});
