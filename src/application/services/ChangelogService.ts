import type { LeifRuntimeState } from "@/domain/types/LeifRuntimeState";

export interface BundledReleaseNote {
  version: string;
  title: string;
  body: string;
  githubUrl: string;
}

export class ChangelogService {
  constructor(private readonly releases: readonly BundledReleaseNote[]) {}

  pendingRelease(
    currentVersion: string,
    runtimeState: LeifRuntimeState
  ): BundledReleaseNote | null {
    if (runtimeState.lastAcknowledgedVersion === currentVersion) {
      return null;
    }

    return this.releases.find((release) => release.version === currentVersion) ?? null;
  }
}
