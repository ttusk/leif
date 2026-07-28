import { ValidationError } from "@/domain/errors/DomainErrors";

/**
 * Acesso: a lightweight URL or vault-file link through which the learner
 * reaches a Resource. It has no independent progress identity.
 */
export class ResourceAccess {
  constructor(
    public readonly title: string,
    public readonly url: string,
    public readonly notes?: string
  ) {
    if (!title?.trim()) throw new ValidationError("ResourceAccess title is required");
    if (!url?.trim()) throw new ValidationError("ResourceAccess url is required");
  }
}
