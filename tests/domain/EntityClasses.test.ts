import { describe, expect, it } from "vitest";

import { Contest } from "@/domain/entities/Contest";
import { ContestState } from "@/domain/entities/ContestState";
import { Subject } from "@/domain/entities/Subject";
import { StudyItem } from "@/domain/entities/StudyItem";
import { Topic } from "@/domain/entities/Topic";
import { StudySession } from "@/domain/entities/StudySession";
import { QuestionNotebook } from "@/domain/entities/QuestionNotebook";
import { ResourceReference } from "@/domain/entities/ResourceReference";
import { WallLink, WallSubjectSnapshot, Wall } from "@/domain/entities/Wall";
import { ValidationError } from "@/domain/errors/DomainErrors";

describe("Entity Classes", () => {
  describe("Contest", () => {
    it("creates a valid contest", () => {
      const contest = new Contest("c-1", "TRT", [], { noticeLinks: [], examLinks: [], subjectSnapshots: [] });
      expect(contest.id).toBe("c-1");
      expect(contest.name).toBe("TRT");
    });

    it("throws when id is empty", () => {
      expect(() => new Contest("", "TRT", [], { noticeLinks: [], examLinks: [], subjectSnapshots: [] })).toThrow(ValidationError);
    });

    it("throws when name is empty", () => {
      expect(() => new Contest("c-1", "", [], { noticeLinks: [], examLinks: [], subjectSnapshots: [] })).toThrow(ValidationError);
    });

    it("defaults wall to an empty Wall instance", () => {
      const contest = new Contest("c-1", "TRT");
      expect(contest.wall).toBeInstanceOf(Wall);
      expect(contest.wall.noticeLinks).toEqual([]);
      expect(contest.wall.examLinks).toEqual([]);
      expect(contest.wall.subjectSnapshots).toEqual([]);
    });
  });

  describe("Subject", () => {
    it("creates a valid subject", () => {
      const subject = new Subject("s-1", "c-1", "Portuguese", 1, true, 60);
      expect(subject.id).toBe("s-1");
      expect(subject.isActive).toBe(true);
    });

    it("throws when order is negative", () => {
      expect(() => new Subject("s-1", "c-1", "Portuguese", -1)).toThrow(ValidationError);
    });

    it("throws when plannedStudyMinutes is negative", () => {
      expect(() => new Subject("s-1", "c-1", "Portuguese", 1, true, -1)).toThrow(ValidationError);
    });
  });

  describe("StudyItem", () => {
    it("creates a valid study item", () => {
      const item = new StudyItem("i-1", "s-1", "Syntax", 1);
      expect(item.id).toBe("i-1");
      expect(item.order).toBe(1);
    });

    it("throws when weight is negative", () => {
      expect(() => new StudyItem("i-1", "s-1", "Syntax", 1, -1)).toThrow(ValidationError);
    });

    it("accepts an optional totalPages", () => {
      const item = new StudyItem("i-1", "s-1", "Syntax", 1, 1, 0, [], 100);
      expect(item.totalPages).toBe(100);
    });

    it("throws when totalPages is negative", () => {
      expect(() => new StudyItem("i-1", "s-1", "Syntax", 1, 1, 0, [], -1)).toThrow(ValidationError);
    });
  });

  describe("Topic", () => {
    it("creates a valid topic", () => {
      const topic = new Topic("t-1", "s-1", "Clauses");
      expect(topic.id).toBe("t-1");
      expect(topic.subjectId).toBe("s-1");
      expect(topic.name).toBe("Clauses");
    });
  });

  describe("StudySession", () => {
    it("creates a valid session", () => {
      const session = new StudySession("s-1", "c-1", "pdf", "2026-06-11");
      expect(session.id).toBe("s-1");
    });

    it("throws when correctAnswers exceeds pagesOrCount", () => {
      expect(() => new StudySession("s-1", "c-1", "questions", "2026-06-11", undefined, undefined, undefined, undefined, undefined, 10, 15)).toThrow(ValidationError);
    });

    it("throws when pagesOrCount is negative", () => {
      expect(() => new StudySession("s-1", "c-1", "pdf", "2026-06-11", undefined, undefined, undefined, undefined, undefined, -1)).toThrow(ValidationError);
    });
  });

  describe("QuestionNotebook", () => {
    it("creates a valid notebook", () => {
      const nb = new QuestionNotebook("n-1", "Tec", "https://example.com", 10, 8);
      expect(nb.id).toBe("n-1");
    });

    it("throws when correctAnswers exceeds solvedQuestions", () => {
      expect(() => new QuestionNotebook("n-1", "Tec", "https://example.com", 10, 15)).toThrow(ValidationError);
    });

    it("throws when solvedQuestions is negative", () => {
      expect(() => new QuestionNotebook("n-1", "Tec", "https://example.com", -1)).toThrow(ValidationError);
    });
  });

  describe("ResourceReference", () => {
    it("creates a valid reference", () => {
      const ref = new ResourceReference("r-1", "Video", "video", "https://example.com");
      expect(ref.id).toBe("r-1");
      expect(ref.type).toBe("video");
    });

    it("throws when id is empty", () => {
      expect(() => new ResourceReference("", "Video", "video")).toThrow(ValidationError);
    });
  });

  describe("Wall", () => {
    it("creates a valid wall", () => {
      const wall = new Wall(
        [new WallLink("l-1", "Edital", "https://example.com")],
        [],
        []
      );
      expect(wall.noticeLinks).toHaveLength(1);
    });

    it("creates an empty wall with defaults", () => {
      const wall = new Wall();
      expect(wall.noticeLinks).toEqual([]);
      expect(wall.examLinks).toEqual([]);
      expect(wall.subjectSnapshots).toEqual([]);
    });
  });

  describe("ContestState", () => {
    it("creates a valid state", () => {
      const state = new ContestState("c-1", "s-1", "i-1");
      expect(state.contestId).toBe("c-1");
      expect(state.currentSubjectId).toBe("s-1");
    });

    it("throws when contestId is empty", () => {
      expect(() => new ContestState("")).toThrow(ValidationError);
    });
  });
});
