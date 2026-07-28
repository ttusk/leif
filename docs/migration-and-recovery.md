# Migration and recovery in Leif 3.0

Leif 3.0 makes readable Markdown schema 2 the only writable store for study data. JSON keeps only operational state: the active UI selection, the changelog acknowledgement, migration/recovery receipts, the diagnostic cache, and disposable indexes. This document describes how pre-3.0 stores are migrated and how recovery works.

## What gets migrated

- **Legacy JSON (`data.json`)**: schema 1 through schema 3 concurso data, subjects, items, topics, resources, sessions, and cycle state.
- **Markdown schema 1** bundles (`Leif/concursos/<slug>-<shortId>/...` with `^leif-ref-<hex>` block IDs).
- **Markdown schema 2 session trees**: backed up and consolidated into monthly Registro documents on startup.
- **Already current schema-2** concursos are left untouched.
- **Interrupted migrations** are detected by a `started` receipt and resumed as recovery, never as a fresh automatic migration.

## When migration runs

Migration runs automatically on startup per concurso when its source has not yet been recorded as a `migrated` receipt. A failure isolates the affected concurso as read-only and never throws out of startup; other concursos continue normally.

## How migration runs

For each non-current concurso, Leif:

1. validates the source just enough to build a read-only projection;
2. creates and reads back an immutable source backup under `Leif/.backups/migration-<transactionId>/`;
3. records a `started` receipt immediately after the backup;
4. projects the source into the schema-3 domain model;
5. renders schema-2 Markdown under a unique staging root (`Leif/.staging/...`);
6. rereads the staged tree and semantically compares every entity, relation, order, progress value, cycle position, and preserved user-owned fragment;
7. fingerprints the source again immediately before swap;
8. atomically activates the staged tree;
9. upserts the same receipt to `migrated` (or `failed`).

Backups are kept forever. They are never deleted automatically.

## Mapping rules

- **Contest → Concurso**, preserving the exam plan and the cycle order.
- **Subject → Matéria**, preserving order, activation, planned minutes, and current stage.
- **Topic → Assunto**.
- **StudyItem → Recurso**, retaining its ID, order, page/question targets, and accumulated progress.
- **StudyItem resource references → Acessos** on that Recurso.
- **Topic resource references → independent Recursos** linked to that Assunto.
- **QuestionNotebook → a question-type Recurso** linked to its Assunto.
- **Unreconstructable notebook counters → an `ImportedProgress` baseline** (`progresso-importado` / `acertos-importados`), computed so existing registros are not double-counted.
- **Old flat StudySession → one independent Registro**. Its ID, Concurso, date, measurements, and notes are preserved.
- **Schema-3 Sessão aggregates → independent Registros**. Every child keeps its ID and inherits the Sessão date and Concurso; legacy timing or session notes are preserved on the first Registro.
- **Old current item pointer → current Recurso pointer**, stored as readable wikilinks (`materia-atual` / `recurso-atual`) in `concurso.md`.
- **Wall notes/links/snapshots → one `mural.md`**. Structured snapshots are preserved as readable Markdown.
- **Unknown Markdown schema-1 properties, prose, comments, sections, notes, and attachments → preserved** in the matching schema-2 tree or in an explicit preserved-notes section.

## Failed migrations

A failed migration:

- keeps the source projection readable in memory;
- records a `failed` receipt with diagnostics;
- writes the immutable backup;
- exposes the affected concurso via `readOnlyContestIds()`;
- rejects every study mutation until recovery resolves the receipt;
- never starts a second automatic migration for that concurso.

`Leif/diagnosticos.md` shows actionable Portuguese repair guidance for the affected paths.

## Recovery

Use **Leif: Recuperar backup**.

1. The picker lists compatible `data.json` and schema-1 `manifest.json` backups under `Leif/.backups`.
2. Selecting a backup restores it into staging only (`Leif/.staging/recovery-<transactionId>/...`); nothing in the active tree is overwritten yet.
3. If the source is schema-1, the recovery service upgrades it through the same projector used at startup.
4. The recovery validates the staged files against their final `Leif/concursos/...` paths.
5. If a destination already exists, recovery refuses to overwrite it and reports the conflict.
6. If validation fails, the staged files are left in place and the diagnostics are written to `Leif/diagnosticos.md`.
7. If validation succeeds, recovery moves only validated Markdown from staging into the vault.
8. Recovery never restores JSON as writable authority. There is no JSON rollback path in 3.0.

A concurso recovered into a healthy state becomes writable again on the next full sync.

## Manual backups

Run **Leif: Criar backup agora** to write a schema-2 manifest at `Leif/.backups/manual-<timestamp>/manifest.json` listing every study file path. The backup is immutable and can be selected later by the recovery picker.

## No JSON rollback policy

There is no command or runtime path that restores JSON as the writable study authority. Pre-3.0 commands that activated or deactivated Markdown authority are gone. Recovery restores Markdown, never JSON. If you suspect a corrupt tree:

1. Leave the affected concurso read-only (Leif already enforced this).
2. Run **Leif: Validar Markdown** and follow the diagnostics.
3. If needed, run **Leif: Recuperar backup** to restore from a known-good backup into staging, then validate and activate.

## Backups forever

Backups are never deleted. `Leif/.backups/` grows with manual and automatic backups. Pruning is your responsibility, by deleting backup folders you no longer need. Leif never deletes them for you.
