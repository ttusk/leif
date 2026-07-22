# Migrating from v1 to v2

Leif 2.0 introduces **open Markdown storage**: study content can live as editable Markdown files in your vault instead of the hidden `data.json`. v2 is opt-in per contest, fully reversible, and never destroys v1 data. This guide covers what changes, how to migrate, and how to recover.

## Before you start

- **Nothing is forced.** Installing or updating to Leif v2 does not convert your v1 contests. The legacy JSON store stays fully usable and remains the authority until you explicitly migrate a contest.
- **The minimum Obsidian version** rises to 1.5.7 (pinned and verified at build time).
- The first time Leif v2 needs to persist runtime state or normalized ordering on an existing installation, it creates and reads back a complete, checksum-verified legacy backup in `Leif/.backups/upgrades/`. If that backup cannot be verified, Leif stops startup before registering any writable UI — so your v1 data cannot be silently corrupted.

## What migration does

For a single contest, Leif:

1. shows a **preview** of the files it will create and of every problem that would block migration (duplicate IDs, dangling references, future schemas, Git/sync conflict markers);
2. validates IDs and relationships without changing any data;
3. creates an **immutable, checksummed backup** of that contest in `Leif/.backups/`;
4. writes the Markdown files into `Leif/.staging/` (never over your existing notes);
5. rereads the staged Markdown and compares every field, relation, and order against the source JSON;
6. activates Markdown as the authority **only if the projection is equivalent**.

The legacy JSON snapshot is kept untouched after migration — it is not double-written, and it remains available for rollback.

## Step-by-step

1. **Open the command palette** (`Ctrl/Cmd+P`) in a vault with Leif enabled.
2. Run **Leif: Migrar concurso ativo para Markdown** (the command names are Portuguese; this is the plugin's UI language).
3. Review the preview. If anything is listed under "Migração bloqueada", resolve the cause first (deduplicate IDs, fix relations, commit/abort Git conflicts) and re-run.
4. Confirm. Leif creates the backup, stages the files, verifies, and activates Markdown for that contest. A notice confirms "O Markdown agora é a fonte deste concurso."
5. Repeat per contest — migration is independent for each one.

## Vault layout after migration

```text
Leif/
├── README.md
├── AGENTS.md
├── templates/          (concurso, materia, registro)
├── .backups/           (immutable, do not edit)
├── .staging/           (transient, do not edit)
└── concursos/<contest-slug>/
    ├── concurso.md
    ├── materias/
    ├── itens/
    ├── assuntos/
    ├── recursos/
    ├── mural/
    └── registros/
```

Paths are presentation; stability comes from each document's `leif-id`. Reference lists inside managed regions end with `^leif-ref-<hex>` block IDs that encode the target `leif-id`. See the [Markdown storage contract](markdown-storage-v1.md) for the full spec.

## Editing Markdown outside Obsidian (humans and AI agents)

After migration the Markdown is the authority, so you (or an AI agent, or a sync tool) can edit it directly. The rules that keep Leif's writes safe:

- Preserve each document's `leif-id`, `^leif-ref-...` block IDs, and `<!-- leif:...:start -->` / `<!-- leif:...:end -->` region markers.
- Keep exactly one ordered marker pair per managed region; list position is the order.
- Never edit under `.backups/` or `.staging/`.
- Don't guess a missing parent or identity — leave uncertain content as an ordinary draft outside managed regions.

Leif rereads the Markdown on the next index refresh. If a person, agent, Git, or sync changes the source during a Leif write, the write is aborted rather than overwriting either writer. Documents with duplicate IDs, invalid relations, merge-conflict markers, or future `leif-schema` values are blocked from writing and surfaced as diagnostics in the panel.

## Rollback

Migration is reversible while the legacy snapshot is intact:

1. Run **Leif: Voltar concurso ativo ao JSON legado**.
2. Rollback is only allowed while the legacy snapshot still matches its original checksum (i.e. it was not externally modified after the backup).
3. The Markdown files are never deleted — only the active source switches back to JSON.

## Downgrade protection

If you later open the vault with an older Leif (v1) after a contest was migrated to Markdown, the JSON snapshot is still present and readable by v1. However, any study progress recorded only in Markdown will not be visible to v1. The recommended path is: rollback to JSON (in v2) *before* downgrading, or keep both versions in sync via the snapshot.

## Summary

| Concern | v1 | v2 (after opt-in migration) |
|---|---|---|
| Content store | hidden `data.json` | open Markdown in `Leif/concursos/` |
| Authority | JSON | Markdown (semantic equivalence verified) |
| Backup | — | immutable checksummed, per upgrade and per contest |
| Rollback | — | one command, while checksum intact |
| External/agent editing | not supported | supported, with a documented contract |
| Minimum Obsidian | 1.5.0 | 1.5.7 |