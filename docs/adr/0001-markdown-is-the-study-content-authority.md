---
status: accepted
---

# Markdown is the authority for study content

Leif v2 stores concursos, matérias, assuntos, recursos, and registros de estudo as human-readable Markdown in the user's vault. Plugin JSON remains authoritative only for runtime state, migration receipts, and disposable indexes. Existing JSON content is never replaced until a staged Markdown export parses back to an equivalent snapshot and a restorable backup has been recorded; Leif does not maintain two writable authorities for the same concurso.

## Consequences

Leif patches only its own flat properties and explicitly marked regions, preserves unknown content, identifies records by stable IDs rather than paths, and treats malformed, duplicate, ambiguous, or future-schema documents as read-only diagnostics instead of silently repairing them.
