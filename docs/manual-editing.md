# Manual editing in Leif 3.0

Leif 3.0 reads and writes its study data as readable Markdown in `Leif/`. This guide describes the safe workflows for editing those files by hand or with an AI agent. See `docs/leif-markdown.md` for the schema reference.

## Before you start

- Leif syncs external edits automatically at startup and on debounced vault events. You do not need to run a command before opening the panel, but you can run **Leif: Validar e sincronizar Markdown** to canonicalize files immediately.
- The sync is idempotent and only makes safe changes that its verified plan describes: assign missing IDs, append valid unlisted children to parent wikilink regions, and rewrite `Leif/diagnosticos.md`.
- Invalid or incomplete files are left untouched until you fix them; Leif never destroys unmanaged prose, frontmatter, headings, or attachments.

## Create

1. Create the file in the correct folder for its entity type (see the layout in `docs/leif-markdown.md`). For a Registro, add a new H2 block to the matching monthly document instead.
2. Use the matching template (or any existing entity of the same type) as the reference for frontmatter and managed regions.
3. Omit `leif-id`. Leif assigns one on the next sync.
4. Use the file's H1 as the canonical name. Do not put the name in frontmatter.
5. Save. Leif picks it up on the next debounce, assigns an ID, and links it from the parent wikilink region.

### A note on templates

Leif 3.0 ships no `leif-id` in its templates. The only ID-bearing surface is a fully written document. Copying a template leaves the new file ID-less until sync, exactly as intended.

## Copy

Copying a file copies its `leif-id`. On the next sync Leif detects the duplicate and resolves it only when the last-known index proves which file is the new copy; otherwise the duplicate stays read-only with an actionable diagnostic.

To force a clean copy:

1. Copy the file.
2. Remove the `leif-id` line from the copy's frontmatter.
3. Save. Leif assigns a fresh ID on the next sync.

## Rename

- Rename an **entity file** freely. Leif resolves entities by `leif-id`, so a rename preserves identity, cycle position, registros, and mural links. Monthly Registro documents keep their `YYYY-MM.md` names.
- Rename the **H1** to rename the entity. The next sync updates parent wikilink labels automatically.
- Do not put IDs in filenames; readable slugs own the path.

## Move / reparent

Move a file into the folder of the new parent. The hierarchy index reads containment from the file's path, so on the next sync Leif:

- updates the old parent's wikilink region (removes the moved link),
- updates the new parent's wikilink region (appends the new link),
- preserves the `leif-id` and any cycle position that still resolves.

If the move crosses concursos (e.g., moves a Recurso to another Matéria), any references that no longer resolve to the new parent's scope are reported in diagnostics and the affected files are left read-only until you repair them.

## Reorder

Plan sequence is owned by ordered wikilink lists. Reorder a Matéria, Recurso, or Assunto by editing the linked list inside the parent's managed region between `<!-- leif:<region>:start -->` and `<!-- leif:<region>:end -->`. Registros are historical facts and are canonicalized by date and ID instead of owning a study sequence.

The first incomplete ordered Recurso of the active Matéria is the recommendation, so reordering changes what **Hoje** shows next.

## Duplicate

See **Copy**. The duplicate must either receive a new `leif-id` (delete the copied line, let sync assign one) or keep a fresh `leif-id` of its own; ambiguous duplicates block sync.

## Delete

Delete an entity file, or remove one Registro H2 block from its monthly document. Leif:

- cancels pending writes affected by the deletion,
- removes the link from the parent's wikilink region on the next sync,
- keeps cycle position only if it still resolves, otherwise clears it,
- leaves existing migration and manual backups under `Leif/.backups/` untouched.

Deleting a parent (e.g., a Matéria) cascades to its children through the planner; run **Leif: Validar e sincronizar Markdown** to apply the planned deletions.

## Diagnose

Run **Leif: Validar Markdown** to rewrite `Leif/diagnosticos.md`. The report lists:

- stable diagnostic code and severity,
- affected path,
- Portuguese explanation,
- concrete repair guidance,
- informational entries for safe auto-repairs Leif already applied.

A read-only concurso remains read-only until its diagnostics are clean. No code path writes legacy study content over a broken workspace.

## Agent workflows

Agents edit exactly the same files, in the same editor or outside Obsidian. Workflow:

1. Read `docs/leif-markdown.md` before authoring files.
2. Create or edit files following the layout. Omit `leif-id` from new files.
3. Avoid touching managed regions unless you intentionally want to reorder; the sync rewrites them with the canonical order.
4. Run **Leif: Validar e sincronizar Markdown** (or restart Obsidian) to canonicalize, assign missing IDs, and surface diagnostics.
5. Inspect `Leif/diagnosticos.md` after every batch; address anything blocking before further writes.

The same rules that keep UI and external edits consistent apply to agents: no opaque relationship tokens in paths or wikilinks, no IDs in filenames, no assumptions about ordering outside managed regions.
