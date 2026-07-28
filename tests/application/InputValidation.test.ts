import { describe, expect, it } from "vitest";

import {
  AddResourceAccessValidator,
  CreateContestValidator,
  CreateResourceValidator,
  CreateSubjectValidator,
  CreateTopicValidator,
  RegisterStudySessionValidator,
  UpdateContestMuralValidator
} from "@/application/validation/InputValidators";
import { GoalUnit } from "@/domain/types/GoalUnit";

describe("input validators", () => {
  it("validates contest, subject and topic creation", () => {
    expect(new CreateContestValidator().validate({ id: "", name: "TRT" }).valid).toBe(false);
    expect(
      new CreateSubjectValidator().validate({
        id: "subject-1",
        contestId: "contest-1",
        name: "Português",
        plannedStudyMinutes: -1
      }).valid
    ).toBe(false);
    expect(
      new CreateTopicValidator().validate({ id: "topic-1", subjectId: "", name: "X" }).valid
    ).toBe(false);
  });

  it("validates resource goal amount/unit pairing", () => {
    expect(
      new CreateResourceValidator().validate({
        subjectId: "subject-1",
        title: "PDF",
        goalAmount: 10
      }).valid
    ).toBe(false);
    expect(
      new CreateResourceValidator().validate({
        subjectId: "subject-1",
        title: "PDF",
        goalAmount: 10,
        goalUnit: GoalUnit.PAGINAS
      }).valid
    ).toBe(true);
  });

  it("rejects empty sessions and invalid record units", () => {
    expect(
      new RegisterStudySessionValidator().validate({
        contestId: "contest-1",
        date: "2026-07-27",
        records: []
      }).valid
    ).toBe(false);
    expect(
      new RegisterStudySessionValidator().validate({
        contestId: "contest-1",
        date: "2026-07-27",
        records: [{ subjectId: "subject-1", unit: "foo" as GoalUnit }]
      }).valid
    ).toBe(false);
  });

  it("validates resource accesses and mural snapshots", () => {
    expect(
      new AddResourceAccessValidator().validate({
        resourceId: "resource-1",
        title: "",
        url: "https://example.com"
      }).valid
    ).toBe(false);
    expect(
      new UpdateContestMuralValidator().validate({
        contestId: "contest-1",
        snapshots: [{ subjectId: "subject-1", weight: -1 }]
      }).valid
    ).toBe(false);
  });
});
