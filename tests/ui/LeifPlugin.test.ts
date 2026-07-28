// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import LeifPlugin from "@/main";
import { Contest } from "@/domain/entities/Contest";
import { CycleState } from "@/domain/entities/CycleState";
import { Resource } from "@/domain/entities/Resource";
import { Subject } from "@/domain/entities/Subject";
import { createDefaultLeifPluginData } from "@/domain/types/LeifPluginData";
import {
  App,
  getOpenModals,
  getRecordedNotices,
  Plugin,
  resetOpenModals,
  resetRecordedNotices,
  TFile
} from "../mocks/obsidian";

describe("LeifPlugin", () => {
  it("registers the Leif panel and backup recovery command without settings tab", async () => {
    const plugin = new LeifPlugin(new App() as never, { version: "2.1.1" } as never);

    await plugin.initialize();

    const registeredPlugin = plugin as unknown as Plugin;
    expect(registeredPlugin.settingTabs).toHaveLength(0);
    expect(registeredPlugin.commands.map((command) => command.id)).toEqual([
      "open-view",
      "open-today",
      "new-study-session",
      "register-recommended-study",
      "advance-cycle-without-record",
      "validate-markdown",
      "validate-and-sync-markdown",
      "open-diagnostics",
      "create-backup",
      "recover-backup"
    ]);
    expect(registeredPlugin.commands.map((command) => command.name)).toEqual([
      "Abrir painel",
      "Abrir Hoje",
      "Nova sessão de estudo",
      "Registrar estudo recomendado",
      "Avançar ciclo sem registrar",
      "Validar Markdown",
      "Validar e sincronizar Markdown",
      "Abrir relatório de diagnósticos",
      "Criar backup agora",
      "Recuperar backup"
    ]);
    expect(registeredPlugin.ribbonIcons.map((icon) => icon.title)).toEqual(["Abrir Leif"]);
  });

  it("opens Hoje and Registros from command palette shortcuts", async () => {
    const app = new App();
    await seedSchema2WorkspaceWithoutMural(app);
    const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
    const operational = createDefaultLeifPluginData();
    operational.activeContestId = "contest-1";
    await plugin.saveData(operational);
    await plugin.initialize();
    const commands = (plugin as unknown as Plugin).commands;

    await commands.find((command) => command.id === "new-study-session")?.callback();
    const openedView = app.workspace.leaves.find(
      (leaf) => leaf.view?.getDisplayText() === "Leif"
    )?.view;
    if (!openedView) throw new Error("Expected Leif view to open.");
    expect(openedView.contentEl.textContent).toContain("Registros");
    expect(openedView.contentEl.textContent).toContain("Novo registro");

    await commands.find((command) => command.id === "register-recommended-study")?.callback();
    expect(openedView.contentEl.textContent).toContain("Novo registro");

    await commands.find((command) => command.id === "open-today")?.callback();
    expect(openedView.contentEl.textContent).toContain("Hoje");
    expect(openedView.contentEl.textContent).toContain("Agora");
    expect(openedView.contentEl.textContent).toContain("Próxima:");
  });

  it("advances the active cycle without recording a study session", async () => {
    resetRecordedNotices();
    const app = new App();
    const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
    await plugin.saveData(seedOperationalCycleData());
    await plugin.initialize();
    const advance = (plugin as unknown as Plugin).commands.find(
      (command) => command.id === "advance-cycle-without-record"
    );

    await advance?.callback();

    expect(await app.vault.adapter.read("Leif/concursos/trt/concurso.md")).toContain(
      'materia-atual: "[[materias/direito/materia]]"'
    );
    expect(await app.vault.adapter.read("Leif/concursos/trt/concurso.md")).toContain(
      'recurso-atual: "[[materias/direito/recursos/pdf-02/recurso]]"'
    );
    expect(getRecordedNotices()).toEqual(["Ciclo avançado para Direito."]);
  });

  it("creates a manual Markdown backup from the command palette", async () => {
    resetRecordedNotices();
    const app = new App();
    await seedSchema2WorkspaceWithoutMural(app);
    const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
    await plugin.initialize();
    const createBackup = (plugin as unknown as Plugin).commands.find(
      (command) => command.id === "create-backup"
    );

    await createBackup?.callback();

    const backups = await app.vault.adapter.list("Leif/.backups");
    expect(backups.folders).toHaveLength(1);
    const manifest = await app.vault.adapter.read(`${backups.folders[0]}/manifest.json`);
    expect(manifest).toContain("Leif/concursos/trt/concurso.md");
    expect(manifest).toContain("Leif/concursos/trt/materias/portugues/materia.md");
    expect(getRecordedNotices()).toEqual([`Backup criado em ${backups.folders[0]}.`]);
  });

  it("recovers the latest JSON backup into staging from the command palette", async () => {
    resetRecordedNotices();
    const app = new App();
    await app.vault.createFolder("Leif");
    await app.vault.createFolder("Leif/.backups");
    await app.vault.createFolder("Leif/.backups/migration-tx");
    const backup = {
      ...createDefaultLeifPluginData(),
      contests: [new Contest("contest-1", "TRT", ["subject-1"])],
      subjects: [
        new Subject("subject-1", "contest-1", "Português", 1, true, 0, undefined, ["resource-1"])
      ],
      resources: [new Resource("resource-1", "subject-1", "PDF 01", 1)]
    };
    await app.vault.adapter.write(
      "Leif/.backups/migration-tx/data.json",
      `${JSON.stringify(backup, null, 2)}\n`
    );
    const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
    await plugin.initialize();
    const recover = (plugin as unknown as Plugin).commands.find(
      (command) => command.id === "recover-backup"
    );

    await recover?.callback();

    expect(getRecordedNotices()).toEqual(["Backup recuperado em Leif/.staging/recovery-manual."]);
    expect(
      await app.vault.adapter.read("Leif/.staging/recovery-manual/Leif/concursos/trt/concurso.md")
    ).toContain("leif-schema: 2");
  });

  it("validates Markdown and opens the generated diagnostics report from commands", async () => {
    resetRecordedNotices();
    const app = new App();
    const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
    await plugin.initialize();
    const commands = (plugin as unknown as Plugin).commands;
    const validate = commands.find((command) => command.id === "validate-markdown");
    const openDiagnostics = commands.find((command) => command.id === "open-diagnostics");

    await validate?.callback();

    expect(await app.vault.adapter.read("Leif/diagnosticos.md")).toContain("SCHEMA2_OK");
    expect(getRecordedNotices()).toEqual(["Validação concluída: nenhum problema encontrado."]);

    await openDiagnostics?.callback();

    expect(app.workspace.leaves[app.workspace.leaves.length - 1]?.openedFile?.path).toBe(
      "Leif/diagnosticos.md"
    );
  });

  it("validates and synchronizes Markdown through the command palette", async () => {
    resetRecordedNotices();
    const app = new App();
    await seedSchema2WorkspaceWithoutMural(app);
    const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
    await plugin.initialize();
    await app.vault.adapter.remove("Leif/concursos/trt/mural.md");
    const sync = (plugin as unknown as Plugin).commands.find(
      (command) => command.id === "validate-and-sync-markdown"
    );

    await sync?.callback();

    expect(await app.vault.adapter.read("Leif/concursos/trt/mural.md")).toContain(
      "leif-type: mural"
    );
    expect(await app.vault.adapter.read("Leif/diagnosticos.md")).toContain("SCHEMA2_OK");
    expect(getRecordedNotices()).toEqual(["Sincronização concluída: nenhum problema encontrado."]);
  });

  it("runs a silent full Markdown synchronization on startup", async () => {
    resetRecordedNotices();
    const app = new App();
    await seedSchema2WorkspaceWithoutMural(app);
    const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);

    await plugin.initialize();

    expect(await app.vault.adapter.read("Leif/concursos/trt/mural.md")).toContain(
      "leif-type: mural"
    );
    expect(await app.vault.adapter.read("Leif/diagnosticos.md")).toContain("SCHEMA2_OK");
    expect(getRecordedNotices()).toEqual([]);
  });

  it("debounces external Leif Markdown changes and ignores generated paths", async () => {
    vi.useFakeTimers();
    try {
      resetRecordedNotices();
      const app = new App();
      await seedSchema2WorkspaceWithoutMural(app);
      const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
      const operational = createDefaultLeifPluginData();
      operational.activeContestId = "contest-1";
      await plugin.saveData(operational);
      await plugin.initialize();
      await app.vault.adapter.remove("Leif/concursos/trt/mural.md");

      app.vault.trigger("modify", new TFile("Leif/diagnosticos.md"));
      app.vault.trigger("modify", new TFile("Leif/.staging/tx/Leif/concursos/trt/concurso.md"));
      app.vault.trigger("modify", new TFile("Leif/.backups/migration-tx/data.json"));
      await vi.advanceTimersByTimeAsync(500);
      expect(await app.vault.adapter.read("Leif/concursos/trt/mural.md")).toBe("");

      app.vault.trigger("modify", new TFile("Leif/concursos/trt/concurso.md"));
      app.vault.trigger("modify", new TFile("Leif/concursos/trt/materias/portugues/materia.md"));
      await vi.advanceTimersByTimeAsync(399);
      expect(await app.vault.adapter.read("Leif/concursos/trt/mural.md")).toBe("");

      await vi.advanceTimersByTimeAsync(1);

      expect(await app.vault.adapter.read("Leif/concursos/trt/mural.md")).toContain(
        "leif-type: mural"
      );
      expect(getRecordedNotices()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes open Leif views after external Markdown synchronization", async () => {
    vi.useFakeTimers();
    try {
      const app = new App();
      await seedSchema2WorkspaceWithoutMural(app);
      const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
      const operational = createDefaultLeifPluginData();
      operational.activeContestId = "contest-1";
      await plugin.saveData(operational);
      await plugin.initialize();
      const openView = (plugin as unknown as Plugin).commands.find(
        (command) => command.id === "open-view"
      );
      await openView?.callback();
      const openedView = app.workspace.leaves.find(
        (leaf) => leaf.view?.getDisplayText() === "Leif"
      )?.view;
      if (!openedView) throw new Error("Expected Leif view to open.");

      expect(openedView.contentEl.textContent).toContain("Português");
      await vi.advanceTimersByTimeAsync(801);

      await app.vault.adapter.write(
        "Leif/concursos/trt/materias/portugues/materia.md",
        `${schema2Doc("materia", "subject-1", "Direito Constitucional")}## Assuntos

<!-- leif:assuntos:start -->
<!-- leif:assuntos:end -->

## Recursos

<!-- leif:recursos:start -->
<!-- leif:recursos:end -->
`
      );
      app.vault.trigger("modify", new TFile("Leif/concursos/trt/materias/portugues/materia.md"));

      await vi.advanceTimersByTimeAsync(400);

      expect(openedView.contentEl.textContent).toContain("Direito Constitucional");
      expect(openedView.contentEl.textContent).not.toContain("Português");
    } finally {
      vi.useRealTimers();
    }
  });

  it("suppresses Vault events emitted by its own Markdown sync writes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T12:00:00.000Z"));
    try {
      const app = new App();
      await seedSchema2WorkspaceWithoutMural(app);
      const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
      await plugin.initialize();
      await app.vault.adapter.remove("Leif/concursos/trt/mural.md");

      app.vault.trigger("modify", new TFile("Leif/concursos/trt/concurso.md"));
      await vi.advanceTimersByTimeAsync(400);
      const diagnosticsAfterSync = await app.vault.adapter.read("Leif/diagnosticos.md");

      app.vault.trigger("create", new TFile("Leif/concursos/trt/mural.md"));
      await vi.advanceTimersByTimeAsync(400);

      expect(await app.vault.adapter.read("Leif/diagnosticos.md")).toBe(diagnosticsAfterSync);
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a backup picker when multiple compatible backups are available", async () => {
    resetOpenModals();
    resetRecordedNotices();
    const app = new App();
    await app.vault.createFolder("Leif");
    await app.vault.createFolder("Leif/.backups");
    await app.vault.createFolder("Leif/.backups/migration-a");
    await app.vault.createFolder("Leif/.backups/migration-b");
    await app.vault.adapter.write(
      "Leif/.backups/migration-a/data.json",
      `${JSON.stringify(backupWithContestName("TRT A"), null, 2)}\n`
    );
    await app.vault.adapter.write(
      "Leif/.backups/migration-b/data.json",
      `${JSON.stringify(backupWithContestName("TRT B"), null, 2)}\n`
    );
    const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
    await plugin.initialize();
    const recover = (plugin as unknown as Plugin).commands.find(
      (command) => command.id === "recover-backup"
    );

    await recover?.callback();

    const [modal] = getOpenModals();
    expect(modal?.contentEl.textContent).toContain("migration-a/data.json");
    expect(modal?.contentEl.textContent).toContain("migration-b/data.json");
    expect(
      await app.vault.adapter.read("Leif/.staging/recovery-manual/Leif/concursos/trt-a/concurso.md")
    ).toBe("");

    const buttons = Array.from(modal!.contentEl.querySelectorAll("button"));
    const firstBackup = buttons.find((button) =>
      button.textContent?.includes("migration-a/data.json")
    ) as HTMLButtonElement;
    firstBackup.click();

    await vi.waitFor(async () => {
      expect(
        await app.vault.adapter.read(
          "Leif/.staging/recovery-manual/Leif/concursos/trt-a/concurso.md"
        )
      ).toContain("# TRT A");
    });
    expect(getOpenModals()).toHaveLength(0);
  });

  it("recovers a schema-1 manifest backup into staging from the command palette", async () => {
    resetRecordedNotices();
    const app = new App();
    await app.vault.createFolder("Leif");
    await app.vault.createFolder("Leif/.backups");
    await app.vault.createFolder("Leif/.backups/migration-schema1");
    await app.vault.adapter.write(
      "Leif/.backups/migration-schema1/manifest.json",
      `${JSON.stringify(
        {
          files: [
            {
              path: "Leif/concursos/trt/concurso.md",
              content: schema1Doc("concurso", "contest-1", "TRT")
            }
          ]
        },
        null,
        2
      )}\n`
    );
    const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
    await plugin.initialize();
    const recover = (plugin as unknown as Plugin).commands.find(
      (command) => command.id === "recover-backup"
    );

    await recover?.callback();

    expect(
      await app.vault.adapter.read("Leif/.staging/recovery-manual/Leif/concursos/trt/concurso.md")
    ).toContain("leif-schema: 2");
  });

  it("writes diagnostics when backup recovery cannot be planned", async () => {
    resetRecordedNotices();
    const app = new App();
    await app.vault.createFolder("Leif");
    await app.vault.createFolder("Leif/.backups");
    await app.vault.createFolder("Leif/.backups/migration-invalid");
    const backup = {
      ...createDefaultLeifPluginData(),
      contests: [new Contest("contest-1", "TRT", ["subject-1"])],
      cycleStates: [new CycleState("contest-1", "subject-1", "missing-resource")],
      subjects: [new Subject("subject-1", "contest-1", "Português", 1)]
    };
    await app.vault.adapter.write(
      "Leif/.backups/migration-invalid/data.json",
      `${JSON.stringify(backup, null, 2)}\n`
    );
    const plugin = new LeifPlugin(app as never, { version: "2.1.1" } as never);
    await plugin.initialize();
    const recover = (plugin as unknown as Plugin).commands.find(
      (command) => command.id === "recover-backup"
    );

    await recover?.callback();

    expect(await app.vault.adapter.read("Leif/diagnosticos.md")).toContain(
      "SCHEMA2_RECOVERY_FAILED"
    );
    expect(getRecordedNotices()).toEqual([
      "Backup não recuperado: relatório salvo em Leif/diagnosticos.md."
    ]);
    expect(
      await app.vault.adapter.read("Leif/.staging/recovery-manual/Leif/concursos/trt/concurso.md")
    ).toBe("");
  });

  it("silently records the current version for a fresh install", async () => {
    resetOpenModals();
    const plugin = new LeifPlugin(new App() as never, { version: "2.1.1" } as never);

    await plugin.initialize();

    expect(getOpenModals()).toHaveLength(0);
    const saved = (await plugin.loadData()) as ReturnType<typeof createDefaultLeifPluginData>;
    expect(saved.runtimeState?.lastAcknowledgedVersion).toBe("2.1.1");
    expect(await plugin.app.vault.adapter.read("Leif/diagnosticos.md")).toContain(
      "Resultado: sem problemas"
    );
  });

  it("shows bundled notes after an update and acknowledges them explicitly", async () => {
    resetOpenModals();
    const plugin = new LeifPlugin(new App() as never, { version: "2.1.1" } as never);
    const existing = createDefaultLeifPluginData();
    existing.contests.push(new Contest("contest-1", "TRT"));
    existing.runtimeState!.lastAcknowledgedVersion = "2.1.0";
    await plugin.saveData(existing);

    await plugin.initialize();
    await Promise.resolve();

    const [modal] = getOpenModals();
    expect(modal?.contentEl.textContent).toContain("Leif 2.1.1");

    (modal?.contentEl.querySelector("button") as HTMLButtonElement).click();
    expect(getOpenModals()).toHaveLength(0);
    await vi.waitFor(async () => {
      const saved = (await plugin.loadData()) as ReturnType<typeof createDefaultLeifPluginData>;
      expect(saved.runtimeState?.lastAcknowledgedVersion).toBe("2.1.1");
    });
  });
});

function schema1Doc(type: string, id: string, title: string, extra = ""): string {
  return `---
leif-type: ${type}
leif-schema: 1
leif-id: ${id}
${extra}---

# ${title}
`;
}

function schema2Doc(type: string, id: string, title: string, extra = ""): string {
  return `---
leif-type: ${type}
leif-schema: 2
leif-id: ${id}
${extra}---

# ${title}
`;
}

async function seedSchema2WorkspaceWithoutMural(app: App): Promise<void> {
  await app.vault.createFolder("Leif");
  await app.vault.createFolder("Leif/concursos");
  await app.vault.createFolder("Leif/concursos/trt");
  await app.vault.createFolder("Leif/concursos/trt/materias");
  await app.vault.createFolder("Leif/concursos/trt/materias/portugues");
  await app.vault.adapter.write(
    "Leif/concursos/trt/concurso.md",
    `${schema2Doc("concurso", "contest-1", "TRT")}## Ordem do ciclo

<!-- leif:materias:start -->
1. [[materias/portugues/materia|Português]]
<!-- leif:materias:end -->
`
  );
  await app.vault.adapter.write(
    "Leif/concursos/trt/materias/portugues/materia.md",
    `${schema2Doc("materia", "subject-1", "Português")}## Assuntos

<!-- leif:assuntos:start -->
<!-- leif:assuntos:end -->

## Recursos

<!-- leif:recursos:start -->
<!-- leif:recursos:end -->
`
  );
}

function backupWithContestName(name: string): ReturnType<typeof createDefaultLeifPluginData> {
  return {
    ...createDefaultLeifPluginData(),
    contests: [new Contest(`contest-${name}`, name)]
  };
}

function seedOperationalCycleData(): ReturnType<typeof createDefaultLeifPluginData> {
  return {
    ...createDefaultLeifPluginData(),
    activeContestId: "contest-1",
    contests: [new Contest("contest-1", "TRT", ["subject-1", "subject-2"])],
    cycleStates: [new CycleState("contest-1", "subject-1", "resource-1")],
    subjects: [
      new Subject("subject-1", "contest-1", "Português", 1, true, 0, undefined, ["resource-1"]),
      new Subject("subject-2", "contest-1", "Direito", 2, true, 0, undefined, ["resource-2"])
    ],
    resources: [
      new Resource("resource-1", "subject-1", "PDF 01", 1),
      new Resource("resource-2", "subject-2", "PDF 02", 1)
    ]
  };
}
