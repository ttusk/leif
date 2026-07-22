import { describe, expect, it } from "vitest";

import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import { LegacyUpgradeBackupService } from "@/application/services/LegacyUpgradeBackupService";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";

class MemoryFiles implements MarkdownFileStore {
  readonly files = new Map<string, string>();
  corruptReads = false;

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async writeNew(path: string, content: string): Promise<void> {
    if (this.files.has(path)) throw new Error(`exists: ${path}`);
    this.files.set(path, content);
  }

  async read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`missing: ${path}`);
    return this.corruptReads ? `${content}corrupted` : content;
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.files.keys()].filter((path) => path.startsWith(`${prefix}/`));
  }

  async move(): Promise<void> {}
}

function legacyData() {
  const data = createDefaultLeifPluginData();
  delete data.runtimeState;
  data.contests.push({
    id: "contest-1",
    name: "TRT",
    subjectIds: [],
    wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
  });
  return data;
}

describe("LegacyUpgradeBackupService", () => {
  it("creates and verifies one immutable backup before v2 can write legacy data", async () => {
    const files = new MemoryFiles();
    const service = new LegacyUpgradeBackupService(files);

    const first = await service.ensureBackup(legacyData());
    const second = await service.ensureBackup(legacyData());

    expect(first).toEqual(second);
    expect(first?.path).toMatch(/^Leif\/\.backups\/upgrades\/v1-to-v2-[a-f0-9]+\.json$/);
    expect(first?.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(files.files).toHaveLength(1);
    expect(files.files.get(first!.path)).toContain('"contest-1"');
  });

  it("skips fresh installs and data already stamped with the v2 storage runtime", async () => {
    const files = new MemoryFiles();
    const service = new LegacyUpgradeBackupService(files);
    const current = createDefaultLeifPluginData();

    expect(await service.ensureBackup(createDefaultLeifPluginData())).toBeNull();
    current.contests.push({
      id: "contest-1",
      name: "TRT",
      subjectIds: [],
      wall: { noticeLinks: [], examLinks: [], subjectSnapshots: [] }
    });
    expect(await service.ensureBackup(current)).toBeNull();
    expect(files.files).toHaveLength(0);
  });

  it("fails closed when the backup cannot be read back with the same checksum", async () => {
    const files = new MemoryFiles();
    files.corruptReads = true;

    await expect(new LegacyUpgradeBackupService(files).ensureBackup(legacyData())).rejects.toThrow(
      /verificação do backup.*falhou/i
    );
  });
});
