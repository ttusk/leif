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

  it("deduplicates entities by id and keeps the first occurrence", () => {
    const base = createDefaultLeifPluginData();
    const subject = { id: "subject-1", contestId: "c1", name: "Portuguese", order: 1, isActive: true, plannedStudyMinutes: 60, itemIds: [], topicIds: [] };
    const data: LeifPluginData = {
      ...base,
      subjects: [subject, { ...subject, name: "Duplicate" }]
    };

    const migrated = service.migrate({ ...data, schemaVersion: 1 });

    expect(migrated.subjects).toHaveLength(1);
    expect(migrated.subjects[0].name).toBe("Portuguese");
  });

  it("deduplicates subjectIds within each contest", () => {
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

    expect(migrated.contests[0].subjectIds).toEqual(["s1", "s2"]);
  });

  it("is idempotent", () => {
    const data = { ...createDefaultLeifPluginData(), schemaVersion: 1 };
    const once = service.migrate(data);
    const twice = service.migrate(once);
    expect(twice).toEqual(once);
  });
});
