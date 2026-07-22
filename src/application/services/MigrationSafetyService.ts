import type { LeifPluginData } from "@/domain/types/LeifPluginData";
import type { MigrationReceipt } from "@/domain/types/LeifRuntimeState";

export interface MigrationDiagnostic {
  code: string;
  message: string;
  entityId?: string;
}

export class MigrationBlockedError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: MigrationDiagnostic[]
  ) {
    super(message);
    this.name = "MigrationBlockedError";
  }
}

export interface PreparedMigration {
  backupContent: string;
  receipt: MigrationReceipt;
}

export class MigrationSafetyService {
  async prepare(
    rawData: LeifPluginData,
    contestId: string,
    backupPath: string,
    createdAt: string
  ): Promise<PreparedMigration> {
    const diagnostics = this.validateRawData(rawData);
    if (!rawData.contests.some((contest) => contest.id === contestId)) {
      diagnostics.push({
        code: "missing-contest",
        entityId: contestId,
        message: `Contest "${contestId}" does not exist.`
      });
    }

    if (diagnostics.length > 0) {
      throw new MigrationBlockedError(
        "Legacy data must be repaired before migration.",
        diagnostics
      );
    }

    const backupContent = `${JSON.stringify(rawData, null, 2)}\n`;
    const backupChecksum = await sha256(backupContent);
    const sourceChecksum = await this.checksum(rawData, contestId);

    return {
      backupContent,
      receipt: {
        id: `migration-${contestId}-${createdAt}`,
        contestId,
        status: "backed-up",
        backupPath,
        backupChecksum,
        sourceChecksum,
        createdAt
      }
    };
  }

  async verify(
    receipt: MigrationReceipt,
    legacyData: LeifPluginData,
    markdownProjection: LeifPluginData
  ): Promise<MigrationReceipt> {
    const sourceChecksum = await this.checksum(legacyData, receipt.contestId);
    const targetChecksum = await this.checksum(markdownProjection, receipt.contestId);

    if (receipt.status !== "backed-up" || receipt.sourceChecksum !== sourceChecksum) {
      throw new MigrationBlockedError("The migration source changed after backup.", [
        {
          code: "source-changed",
          entityId: receipt.contestId,
          message: "Create a new backup before verifying this migration."
        }
      ]);
    }

    if (sourceChecksum !== targetChecksum) {
      throw new MigrationBlockedError("The Markdown projection is not equivalent to legacy data.", [
        {
          code: "projection-mismatch",
          entityId: receipt.contestId,
          message: "The staged Markdown must match the legacy concurso before activation."
        }
      ]);
    }

    return {
      ...receipt,
      status: "verified",
      targetChecksum,
      verifiedAt: new Date().toISOString()
    };
  }

  validateRawData(data: LeifPluginData): MigrationDiagnostic[] {
    const diagnostics: MigrationDiagnostic[] = [];
    const collections: Array<readonly { id: string }[]> = [
      data.contests,
      data.subjects,
      data.topics,
      data.studyItems,
      data.studySessions
    ];

    collections.forEach((entities) => {
      const seen = new Set<string>();
      entities.forEach((entity) => {
        if (seen.has(entity.id)) {
          diagnostics.push({
            code: "duplicate-id",
            entityId: entity.id,
            message: `Duplicate identity "${entity.id}" must be resolved explicitly.`
          });
        }
        seen.add(entity.id);
      });
    });

    const contests = new Map(data.contests.map((contest) => [contest.id, contest]));
    const subjects = new Map(data.subjects.map((subject) => [subject.id, subject]));
    const studyItems = new Map(data.studyItems.map((item) => [item.id, item]));
    const topics = new Map(data.topics.map((topic) => [topic.id, topic]));

    data.subjects.forEach((subject) => {
      if (!contests.has(subject.contestId)) {
        diagnostics.push({
          code: "orphan-subject",
          entityId: subject.id,
          message: `Subject "${subject.id}" references a missing contest.`
        });
      }
    });

    data.studyItems.forEach((item) => {
      if (!subjects.has(item.subjectId)) {
        diagnostics.push({
          code: "orphan-study-item",
          entityId: item.id,
          message: `Study item "${item.id}" references a missing subject.`
        });
      }
    });

    data.topics.forEach((topic) => {
      if (!subjects.has(topic.subjectId)) {
        diagnostics.push({
          code: "orphan-topic",
          entityId: topic.id,
          message: `Topic "${topic.id}" references a missing subject.`
        });
      }
    });

    data.studySessions.forEach((session) => {
      const contest = contests.get(session.contestId);
      const subject = session.subjectId ? subjects.get(session.subjectId) : undefined;
      const item = session.studyItemId ? studyItems.get(session.studyItemId) : undefined;
      const topic = session.topicId ? topics.get(session.topicId) : undefined;

      if (!contest) {
        diagnostics.push({
          code: "orphan-study-session",
          entityId: session.id,
          message: `Study session "${session.id}" references a missing contest.`
        });
      }
      if (session.subjectId && (!subject || subject.contestId !== session.contestId)) {
        diagnostics.push({
          code: "invalid-session-subject",
          entityId: session.id,
          message: `Study session "${session.id}" references a subject outside its contest.`
        });
      }
      if (session.studyItemId && (!item || item.subjectId !== session.subjectId)) {
        diagnostics.push({
          code: "invalid-session-study-item",
          entityId: session.id,
          message: `Study session "${session.id}" references an item outside its subject.`
        });
      }
      if (session.topicId && (!topic || topic.subjectId !== session.subjectId)) {
        diagnostics.push({
          code: "invalid-session-topic",
          entityId: session.id,
          message: `Study session "${session.id}" references a topic outside its subject.`
        });
      }
    });

    return diagnostics;
  }

  async checksum(data: LeifPluginData, contestId: string): Promise<string> {
    const subjectIds = new Set(
      data.subjects
        .filter((subject) => subject.contestId === contestId)
        .map((subject) => subject.id)
    );
    const projection = {
      contest: data.contests.find((contest) => contest.id === contestId) ?? null,
      contestState:
        data.contestStates.find((contestState) => contestState.contestId === contestId) ?? null,
      subjects: data.subjects.filter((subject) => subject.contestId === contestId),
      topics: data.topics.filter((topic) => subjectIds.has(topic.subjectId)),
      studyItems: data.studyItems.filter((item) => subjectIds.has(item.subjectId)),
      studySessions: data.studySessions.filter((session) => session.contestId === contestId)
    };

    return sha256(stableStringify(projection));
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const sortedItems = value.map(sortValue);
    if (sortedItems.every(isIdentifiedObject)) {
      return [...sortedItems].sort((left, right) => left.id.localeCompare(right.id));
    }
    return sortedItems;
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)])
    );
  }

  return value;
}

function isIdentifiedObject(value: unknown): value is { id: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "string"
  );
}
