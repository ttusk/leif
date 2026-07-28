import { describe, expect, it } from "vitest";

import { ChangelogService } from "@/application/services/ChangelogService";
import {
  createDefaultLeifRuntimeState,
  type LeifRuntimeState
} from "@/domain/types/LeifRuntimeState";

const releases = [
  {
    version: "3.0.0",
    title: "Leif 3.0",
    body: "Markdown schema 2 and the new resource model.",
    githubUrl: "https://github.com/ttusk/leif/releases/tag/3.0.0"
  }
];

function runtime(lastAcknowledgedVersion?: string): LeifRuntimeState {
  return {
    ...createDefaultLeifRuntimeState(),
    lastAcknowledgedVersion
  };
}

describe("ChangelogService", () => {
  it("returns the bundled GitHub release once after an update", () => {
    const service = new ChangelogService(releases);

    expect(service.pendingRelease("3.0.0", runtime())).toEqual(releases[0]);
    expect(service.pendingRelease("3.0.0", runtime("3.0.0"))).toBeNull();
  });

  it("does not show an unrelated release when bundled notes are missing", () => {
    const service = new ChangelogService(releases);
    expect(service.pendingRelease("3.1.0", runtime("3.0.0"))).toBeNull();
  });

  it("does not show or rewrite changelog acknowledgement after a downgrade", () => {
    const service = new ChangelogService(releases);
    expect(service.pendingRelease("3.0.0", runtime("4.0.0"))).toBeNull();
  });
});
