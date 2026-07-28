import { ValidationError } from "@/domain/errors/DomainErrors";
import type { ImportedProgress } from "@/domain/entities/ImportedProgress";
import type { ResourceAccess } from "@/domain/entities/ResourceAccess";
import type { ResourceGoal } from "@/domain/entities/ResourceGoal";

/**
 * Documented initial values for the extensible `format` vocabulary.
 * Unknown values are preserved and rendered, never destructive.
 */
export const ResourceFormat = {
  PDF: "pdf",
  VIDEO: "video",
  QUESTOES: "questoes",
  LIVRO: "livro",
  LINK: "link",
  OUTRO: "outro"
} as const;

export type KnownResourceFormat = (typeof ResourceFormat)[keyof typeof ResourceFormat];

/**
 * Recurso: the progress-bearing study unit of a Matéria. It may cover zero,
 * one or many Assuntos, exposes lightweight Acessos, and completes either by
 * reaching its Meta do recurso or by explicit completion.
 */
export class Resource {
  constructor(
    public readonly id: string,
    public readonly subjectId: string,
    public readonly title: string,
    public readonly order: number,
    public readonly format?: string,
    public readonly goal?: ResourceGoal,
    public readonly completed: boolean = false,
    public readonly topicIds: string[] = [],
    public readonly accesses: ResourceAccess[] = [],
    public readonly baseline?: ImportedProgress
  ) {
    if (!id?.trim()) throw new ValidationError("Resource ID is required");
    if (!subjectId?.trim()) throw new ValidationError("Resource subjectId is required");
    if (!title?.trim()) throw new ValidationError("Resource title is required");
    if (!Number.isInteger(order) || order < 1) {
      throw new ValidationError("Resource order must be a positive integer");
    }
  }
}
