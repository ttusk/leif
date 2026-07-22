# Leif Markdown storage v1

This document defines the initial interoperability contract for humans, Leif, and AI agents.

## Authority

- Markdown is authoritative for concursos, matérias, assuntos, recursos, and registros de estudo.
- Plugin JSON is authoritative for the active concurso, cycle pointers, UI state, migration receipts, and optional disposable indexes.
- Each concurso has exactly one writable storage mode: `legacy-json` or `vault-markdown`.
- Migration never deletes or overwrites the legacy JSON snapshot.

## Corruption-prevention invariants

1. Before switching a concurso to Markdown, Leif creates an immutable backup and checksum.
2. Export happens in a staging directory, not over existing user notes.
3. Leif parses the staged Markdown and compares its domain projection with the source JSON.
4. Authority changes only after semantic equivalence succeeds.
5. Migration is idempotent and records a receipt that can recover an interrupted run.
6. Duplicate IDs, ambiguous parents, future schemas, and merge-conflict markers block writes.
7. Invalid documents do not prevent other concursos from loading; Leif keeps the last-known-good projection and reports diagnostics.
8. Leif never silently chooses one of two conflicting records.
9. Leif preserves unknown properties, prose, comments, attachments, and sections outside managed regions.
10. Same-field concurrent edits abort rather than overwrite either writer.

## Vault layout

```text
Leif/
├── README.md
├── AGENTS.md
└── concursos/
    └── <concurso-slug>/
        ├── concurso.md
        ├── materias/
        │   └── <materia-slug>.md
        └── registros/
            └── YYYY-MM.md
```

Paths are presentation. Stable `leif-id` values are identity.

## Common document properties

Leif uses flat properties so documents remain compatible with Obsidian's Properties UI.

```yaml
---
leif-type: concurso
leif-schema: 1
leif-id: 01k0-example
---
```

Required properties:

- `leif-type`: `concurso`, `materia`, or `registros`.
- `leif-schema`: document schema version.
- `leif-id`: stable identity; changing a filename or path does not change it.

Unknown properties are preserved and ignored by older Leif versions.

## Managed regions

Leif recognizes structured content only inside paired markers.

```markdown
## Matérias

<!-- leif:subjects:start -->
1. [[materias/lingua-portuguesa]]
2. [[materias/raciocinio-logico]]
<!-- leif:subjects:end -->
```

List position is order. Numeric `order` properties are not stored.

Entries use stable Obsidian block IDs:

```markdown
- [ ] Compreensão e interpretação de textos ^leif-topic-01k0a
```

Leif UI writes patch only the targeted property or managed region. Free-form Markdown outside those boundaries belongs to the user.

## Agent workflow

An AI agent can work without a running Obsidian instance:

1. Read `Leif/AGENTS.md`.
2. Copy the nearest template.
3. Create or modify ordinary Markdown files.
4. Preserve stable IDs and managed-region markers.
5. Run the deterministic validator when available.
6. Leave uncertain documents as drafts rather than guessing relationships.

Leif surfaces drafts and diagnostics on the next index refresh.

## Migration policy for existing users

- Upgrading to v2 does not automatically migrate content.
- The existing JSON store remains fully usable.
- Users can preview migration per concurso.
- Preview reports duplicates, orphans, invalid references, and the files that will be created.
- The switch to Markdown is explicit and reversible.
- The legacy snapshot remains available for at least one full release after Markdown becomes the default.

## Update changelog

Leif stores the last acknowledged plugin version in runtime JSON. After an update it opens a one-time changelog screen containing release notes bundled from the repository release source and a link to the matching GitHub release. Bundling keeps the screen available offline and preserves Leif's no-network runtime behavior.
