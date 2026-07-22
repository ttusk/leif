// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type { MigrationPreview } from "@/application/services/StagedMarkdownMigrationService";
import { MigrationConfirmModal } from "@/ui/migration/MigrationConfirmModal";
import { App } from "../mocks/obsidian";

describe("MigrationConfirmModal", () => {
  it("shows the read-only preflight file list before enabling migration", () => {
    const preview: MigrationPreview = {
      contestId: "contest-1",
      files: [
        "Leif/concursos/trt/concurso.md",
        "Leif/concursos/trt/materias/portugues.md"
      ],
      diagnostics: [],
      blocked: false
    };
    const migration = { migrate: vi.fn() };
    const modal = new MigrationConfirmModal(
      new App() as never,
      "TRT",
      "contest-1",
      preview,
      migration as never
    );

    modal.open();

    expect(modal.contentEl.textContent).toContain("Prévia da migração");
    expect(modal.contentEl.textContent).toContain("Leif/concursos/trt/concurso.md");
    expect(modal.contentEl.textContent).toContain("2 arquivos");
    expect(
      [...modal.contentEl.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Criar backup e migrar")
      )?.disabled
    ).toBe(false);
  });

  it("renders blocking diagnostics and prevents confirmation", () => {
    const preview: MigrationPreview = {
      contestId: "contest-1",
      files: ["Leif/concursos/trt/concurso.md"],
      diagnostics: [
        {
          code: "duplicate-id",
          entityId: "subject-1",
          message: "Identidade duplicada"
        }
      ],
      blocked: true
    };
    const modal = new MigrationConfirmModal(
      new App() as never,
      "TRT",
      "contest-1",
      preview,
      { migrate: vi.fn() } as never
    );

    modal.open();

    expect(modal.contentEl.textContent).toContain("Migração bloqueada");
    expect(modal.contentEl.textContent).toContain("Identidade duplicada");
    expect(
      [...modal.contentEl.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Criar backup e migrar")
      )?.disabled
    ).toBe(true);
  });
});
