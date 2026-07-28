import { describe, expect, it } from "vitest";
import { ImportedProgress } from "@/domain/entities/ImportedProgress";
import { Resource } from "@/domain/entities/Resource";
import { ResourceAccess } from "@/domain/entities/ResourceAccess";
import { ResourceGoal } from "@/domain/entities/ResourceGoal";
import { GoalUnit } from "@/domain/types/GoalUnit";
import { ValidationError } from "@/domain/errors/DomainErrors";

describe("Resource", () => {
  it("requires id, subjectId, title and a positive order", () => {
    expect(() => new Resource("", "subject-1", "Aula 03", 1)).toThrow(ValidationError);
    expect(() => new Resource("resource-1", "", "Aula 03", 1)).toThrow(ValidationError);
    expect(() => new Resource("resource-1", "subject-1", " ", 1)).toThrow(ValidationError);
    expect(() => new Resource("resource-1", "subject-1", "Aula 03", 0)).toThrow(ValidationError);
  });

  it("supports an optional goal, explicit completion, covered topics and accesses", () => {
    const resource = new Resource(
      "resource-1",
      "subject-1",
      "Aula 03",
      2,
      "pdf",
      new ResourceGoal(320, GoalUnit.PAGINAS),
      false,
      ["topic-1", "topic-2"],
      [new ResourceAccess("PDF do Estratégia", "https://example.com/aula-03.pdf")]
    );

    expect(resource.goal?.amount).toBe(320);
    expect(resource.goal?.unit).toBe(GoalUnit.PAGINAS);
    expect(resource.completed).toBe(false);
    expect(resource.topicIds).toEqual(["topic-1", "topic-2"]);
    expect(resource.accesses).toHaveLength(1);
    expect(resource.accesses[0].url).toBe("https://example.com/aula-03.pdf");
  });

  it("defaults to not completed with no covered topics or accesses", () => {
    const resource = new Resource("resource-1", "subject-1", "Resumo", 1);

    expect(resource.completed).toBe(false);
    expect(resource.topicIds).toEqual([]);
    expect(resource.accesses).toEqual([]);
    expect(resource.format).toBeUndefined();
    expect(resource.goal).toBeUndefined();
  });

  it("rejects a goal with a non-positive amount or a missing unit", () => {
    expect(() => new ResourceGoal(0, GoalUnit.PAGINAS)).toThrow(ValidationError);
    expect(() => new ResourceGoal(-3, GoalUnit.QUESTOES)).toThrow(ValidationError);
    expect(() => new ResourceGoal(10, "" as GoalUnit)).toThrow(ValidationError);
  });

  it("accepts an extensible format vocabulary without rejecting unknown values", () => {
    const resource = new Resource("resource-1", "subject-1", "Mapa mental", 1, "mapa-mental");

    expect(resource.format).toBe("mapa-mental");
  });

  it("requires access title and url", () => {
    expect(() => new ResourceAccess("", "https://example.com")).toThrow(ValidationError);
    expect(() => new ResourceAccess("Arquivo", " ")).toThrow(ValidationError);
  });

  it("keeps an optional imported progress baseline coherent", () => {
    const resource = new Resource(
      "resource-1",
      "subject-1",
      "Caderno TEC",
      1,
      "questoes",
      undefined,
      false,
      [],
      [],
      new ImportedProgress(120, 96)
    );

    expect(resource.baseline?.quantity).toBe(120);
    expect(resource.baseline?.correctAnswers).toBe(96);
  });

  it("rejects a negative baseline or more correct answers than solved", () => {
    expect(() => new ImportedProgress(-1)).toThrow(ValidationError);
    expect(() => new ImportedProgress(10, 11)).toThrow(ValidationError);
    expect(() => new ImportedProgress(10, -1)).toThrow(ValidationError);
  });
});
