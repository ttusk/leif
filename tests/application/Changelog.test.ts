import { describe, expect, it } from "vitest";

import { ChangelogService } from "@/application/services/ChangelogService";
import type { LeifRuntimeState } from "@/domain/types/LeifRuntimeState";

const releases = [
  {
    version: "2.0.0",
    title: "Leif 2.0",
    body: "Markdown-first storage with safe migration.",
    githubUrl: "https://github.com/ttusk/leif/releases/tag/2.0.0"
  }
];

function runtime(lastAcknowledgedVersion?: string): LeifRuntimeState {
  return {
    storageSchemaVersion: 2,
    markdownRoot: "Leif",
    contestStorage: {},
    migrationReceipts: [],
    lastAcknowledgedVersion
  };
}

describe("ChangelogService", () => {
  it("returns the bundled GitHub release once after an update", () => {
    const service = new ChangelogService(releases);

    expect(service.pendingRelease("2.0.0", runtime())).toEqual(releases[0]);
    expect(service.pendingRelease("2.0.0", runtime("2.0.0"))).toBeNull();
  });

  it("does not show an unrelated release when bundled notes are missing", () => {
    const service = new ChangelogService(releases);
    expect(service.pendingRelease("2.1.0", runtime("2.0.0"))).toBeNull();
  });

  it("does not show or rewrite changelog acknowledgement after a downgrade", () => {
    const service = new ChangelogService(releases);
    expect(service.pendingRelease("2.0.0", runtime("3.0.0"))).toBeNull();
  });
});
