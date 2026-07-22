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
    if (
      runtimeState.lastAcknowledgedVersion &&
      compareVersions(runtimeState.lastAcknowledgedVersion, currentVersion) > 0
    ) {
      return null;
    }

    return this.releases.find((release) => release.version === currentVersion) ?? null;
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
