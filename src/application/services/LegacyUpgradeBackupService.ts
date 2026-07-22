import type { MarkdownFileStore } from "@/application/ports/MarkdownFileStore";
import type { LeifPluginData } from "@/domain/types/LeifPluginData";

export interface LegacyUpgradeBackup {
  path: string;
  checksum: string;
}

export class LegacyUpgradeBackupService {
  constructor(private readonly files: MarkdownFileStore) {}

  async ensureBackup(rawData: LeifPluginData | null): Promise<LegacyUpgradeBackup | null> {
    if (!rawData || isFreshInstall(rawData) || rawData.runtimeState?.storageSchemaVersion === 2) {
      return null;
    }

    const content = `${JSON.stringify(rawData, null, 2)}\n`;
    const checksum = await sha256(content);
    const path = `Leif/.backups/upgrades/v1-to-v2-${checksum.slice(0, 16)}.json`;

    if (!(await this.files.exists(path))) {
      await this.files.writeNew(path, content);
    }

    const persisted = await this.files.read(path);
    if ((await sha256(persisted)) !== checksum) {
      throw new Error(
        `A verificação do backup legado falhou em "${path}". O Leif v2 não alterou os dados do plugin.`
      );
    }

    return { path, checksum };
  }
}

function isFreshInstall(data: LeifPluginData): boolean {
  return (
    data.activeContestId === null &&
    data.contests.length === 0 &&
    data.contestStates.length === 0 &&
    data.subjects.length === 0 &&
    data.topics.length === 0 &&
    data.studyItems.length === 0 &&
    data.studySessions.length === 0
  );
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
