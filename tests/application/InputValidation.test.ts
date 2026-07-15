import { describe, expect, it } from "vitest";

import {
  CreateContestValidator,
  CreateSubjectValidator,
  CreateStudyItemValidator,
  CreateTopicValidator,
  RegisterStudySessionValidator,
  ReorderSubjectsValidator,
  SetActiveContestValidator,
  SetSubjectActiveStateValidator,
  UpdateSubjectConfigurationValidator,
  DeleteStudySessionValidator,
  AddStudyItemResourceReferenceValidator,
  LinkQuestionNotebookValidator,
  UpdateContestWallValidator
} from "@/application/validation/InputValidators";

describe("Input Validators", () => {
  describe("CreateContestValidator", () => {
    it("validates a correct contest input", () => {
      const result = new CreateContestValidator().validate({ id: "contest-1", name: "TRT" });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("fails when id is empty", () => {
      const result = new CreateContestValidator().validate({ id: "", name: "TRT" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("ID is required");
    });

    it("fails when name is empty", () => {
      const result = new CreateContestValidator().validate({ id: "contest-1", name: "" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Name is required");
    });
  });

  describe("CreateSubjectValidator", () => {
    it("validates a correct subject input", () => {
      const result = new CreateSubjectValidator().validate({ id: "sub-1", name: "Portuguese", plannedStudyMinutes: 60 });
      expect(result.valid).toBe(true);
    });

    it("fails when plannedStudyMinutes is negative", () => {
      const result = new CreateSubjectValidator().validate({ id: "sub-1", name: "Portuguese", plannedStudyMinutes: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Planned study minutes cannot be negative");
    });
  });

  describe("CreateStudyItemValidator", () => {
    it("validates a correct study item input", () => {
      const result = new CreateStudyItemValidator().validate({ subjectId: "sub-1", title: "Syntax" });
      expect(result.valid).toBe(true);
    });

    it("fails when weight is negative", () => {
      const result = new CreateStudyItemValidator().validate({ subjectId: "sub-1", title: "Syntax", weight: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Weight cannot be negative");
    });

    it("fails when totalPages is negative", () => {
      const result = new CreateStudyItemValidator().validate({ subjectId: "sub-1", title: "Syntax", totalPages: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Total pages cannot be negative");
    });
  });

  describe("CreateTopicValidator", () => {
    it("validates a correct topic input", () => {
      const result = new CreateTopicValidator().validate({ id: "topic-1", subjectId: "sub-1", name: "Subordinate clauses" });
      expect(result.valid).toBe(true);
    });
  });

  describe("RegisterStudySessionValidator", () => {
    it("validates a correct session input", () => {
      const result = new RegisterStudySessionValidator().validate({
        id: "session-1", contestId: "contest-1", type: "pdf", studiedAt: "2026-06-11"
      });
      expect(result.valid).toBe(true);
    });

    it("fails when a questions session has no positive count", () => {
      const result = new RegisterStudySessionValidator().validate({
        id: "session-1", contestId: "contest-1", type: "questions", studiedAt: "2026-06-11", pagesOrCount: 0
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Questions count must be greater than zero");
    });
  });

  describe("ReorderSubjectsValidator", () => {
    it("validates a correct reorder input", () => {
      const result = new ReorderSubjectsValidator().validate({
        contestId: "contest-1", subjectIdsInOrder: ["sub-1", "sub-2"]
      });
      expect(result.valid).toBe(true);
    });

    it("fails when subjectIdsInOrder is empty", () => {
      const result = new ReorderSubjectsValidator().validate({
        contestId: "contest-1", subjectIdsInOrder: []
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Subject order list cannot be empty");
    });
  });

  describe("SetActiveContestValidator", () => {
    it("validates a correct input", () => {
      const result = new SetActiveContestValidator().validate({ contestId: "contest-1" });
      expect(result.valid).toBe(true);
    });
  });

  describe("SetSubjectActiveStateValidator", () => {
    it("validates a correct input", () => {
      const result = new SetSubjectActiveStateValidator().validate({ subjectId: "sub-1", isActive: true });
      expect(result.valid).toBe(true);
    });
  });

  describe("UpdateSubjectConfigurationValidator", () => {
    it("validates a correct input", () => {
      const result = new UpdateSubjectConfigurationValidator().validate({ subjectId: "sub-1" });
      expect(result.valid).toBe(true);
    });
  });

  describe("DeleteStudySessionValidator", () => {
    it("validates a correct input", () => {
      const result = new DeleteStudySessionValidator().validate({ sessionId: "session-1" });
      expect(result.valid).toBe(true);
    });
  });

  describe("AddStudyItemResourceReferenceValidator", () => {
    it("validates a correct input", () => {
      const result = new AddStudyItemResourceReferenceValidator().validate({
        studyItemId: "item-1",
        resourceReference: { id: "res-1", title: "Video", type: "video" }
      });
      expect(result.valid).toBe(true);
    });

    it("rejects question notebooks as generic item resources", () => {
      const result = new AddStudyItemResourceReferenceValidator().validate({
        studyItemId: "item-1",
        resourceReference: { id: "res-1", title: "Caderno", type: "question-notebook" }
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Resource reference type must be one of: pdf, video, link");
    });
  });

  describe("LinkQuestionNotebookValidator", () => {
    it("validates a correct input", () => {
      const result = new LinkQuestionNotebookValidator().validate({
        topicId: "topic-1",
        questionNotebook: { id: "nb-1", name: "Tec", url: "https://example.com" }
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("UpdateContestWallValidator", () => {
    it("validates a correct input", () => {
      const result = new UpdateContestWallValidator().validate({
        contestId: "contest-1",
        wall: {
          noticeLinks: [{ id: "notice-1", label: "Edital", url: "https://example.com" }],
          examLinks: [{ id: "exam-1", label: "Prova", url: "https://example.com/prova" }],
          subjectSnapshots: [],
          notes: ""
        }
      });
      expect(result.valid).toBe(true);
    });

    it("fails when a wall link URL is invalid", () => {
      const result = new UpdateContestWallValidator().validate({
        contestId: "contest-1",
        wall: {
          noticeLinks: [{ id: "notice-1", label: "Edital", url: "not a url" }],
          examLinks: [],
          subjectSnapshots: [],
          notes: ""
        }
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Wall link URL must be a valid URL");
    });
  });
});
