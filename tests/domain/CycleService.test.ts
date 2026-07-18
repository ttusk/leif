import { describe, expect, it } from "vitest";

import { CycleService } from "@/domain/services/CycleService";
import type { Subject } from "@/domain/entities/Subject";
import type { StudyItem } from "@/domain/entities/StudyItem";

const buildSubject = (overrides: Partial<Subject>): Subject => ({
  id: "subject-1",
  contestId: "contest-1",
  name: "Portuguese",
  order: 1,
  isActive: true,
  plannedStudyMinutes: 60,
  currentStage: "PDF",
  itemIds: [],
  topicIds: [],
  ...overrides
});

const buildItem = (overrides: Partial<StudyItem>): StudyItem => ({
  id: "item-1",
  subjectId: "subject-1",
  title: "Item",
  order: 1,
  ...overrides
});

describe("CycleService", () => {
  it("returns the next active subject and wraps to the first active subject", () => {
    const service = new CycleService();
    const subjects = [
      buildSubject({ id: "subject-1", order: 1, isActive: true }),
      buildSubject({ id: "subject-2", order: 2, isActive: false }),
      buildSubject({ id: "subject-3", order: 3, isActive: true })
    ];

    expect(service.getNextActiveSubject(subjects, "subject-1")?.id).toBe("subject-3");
    expect(service.getNextActiveSubject(subjects, "subject-3")?.id).toBe("subject-1");
  });

  describe("getNextItemId skipping completed items", () => {
    const service = new CycleService();
    const subject = buildSubject({
      itemIds: ["item-1", "item-2", "item-3"]
    });

    const items: StudyItem[] = [
      buildItem({ id: "item-1", order: 1, totalPages: 100 }),
      buildItem({ id: "item-2", order: 2, totalPages: 50 }),
      buildItem({ id: "item-3", order: 3, totalPages: 80 })
    ];

    const isCompleted = (itemId: string): boolean => {
      const item = items.find((i) => i.id === itemId);
      if (!item?.totalPages) return false;
      return 0 >= item.totalPages;
    };

    it("skips items whose read pages meet or exceed totalPages", () => {
      const next = service.getNextItemId(subject, "item-1", isCompleted);

      expect(next).toBe("item-2");
    });

    it("skips multiple consecutive completed items", () => {
      const next = service.getNextItemId(
        subject,
        "item-1",
        (id) => id === "item-1" || id === "item-2"
      );

      expect(next).toBe("item-3");
    });

    it("returns null when every item is completed", () => {
      const next = service.getNextItemId(subject, "item-1", () => true);

      expect(next).toBeNull();
    });

    it("falls back to the first item when no current is set and the first is incomplete", () => {
      const next = service.getNextItemId(subject, undefined, isCompleted);

      expect(next).toBe("item-1");
    });
  });
});
