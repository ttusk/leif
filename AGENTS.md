# AGENTS.md

Guidance for AI harnesses working on the Leif repository. Domain language lives in [CONTEXT.md](CONTEXT.md). The schema-2 Markdown syntax is specified in [docs/leif-markdown.md](docs/leif-markdown.md); hand-editing workflows in [docs/manual-editing.md](docs/manual-editing.md); migration/recovery in [docs/migration-and-recovery.md](docs/migration-and-recovery.md).

## Project

Leif is an Obsidian plugin (TypeScript) that organizes concurso study plans and records the learner's progress. The Obsidian API is pinned to the minimum supported version (1.5.7) and the plugin is mobile-safe (`isDesktopOnly: false`). Since 3.0, readable Markdown schema 2 is the only writable study-data authority; `data.json` keeps only operational state.

## Commands

- `npm run dev` — watch-mode build
- `npm test` or `npx vitest run <file>` — tests (node environment; UI tests opt into jsdom with `// @vitest-environment jsdom`)
- `npm run lint` — eslint
- `npm run format` / `npm run format:check` — prettier
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — typecheck + production build to `main.js`
- `npm run release:check` — full gate: lint, tests, format, build, and `scripts/verify-release.mjs`

## Structure

- `src/domain` — entities and pure domain logic (Contest, Subject, Topic, Resource, StudyRecord, CycleState, Mural)
- `src/application` — use cases, services, ports, and input validators
- `src/infrastructure` — Obsidian adapters, persistence, the schema-2 document codec, hierarchy index, validator, planner, atomic writer, migration projector, and backup recovery
- `src/ui` — view, tabs, modals, recovery picker, and i18n (UI strings are Portuguese)
- `tests/` — mirrors `src`; `tests/mocks/obsidian.ts` mocks the `obsidian` module; path alias `@` → `src`
- `release-notes/<version>.md` — notes shown once after each update and reused as the GitHub release body

## Conventions

- Conventional Commits: `feat|fix|test|docs|refactor|chore|style(<scope>): <message>`, lowercase, one logical change per commit. Features land as test/implementation pairs.
- Code and commit messages in English; product UI, release notes, and the changelog in Portuguese.
- Domain terms follow CONTEXT.md: concurso, matéria, assunto, recurso, acesso, registro de estudo, mural.
- Markdown schema 2 invariants: a unique `leif-id` per entity, exactly one H1 = canonical name, ordered wikilink lists own plan sequence, folder placement owns containment, no IDs in filenames or wikilinks, unknown content preserved losslessly. Independent Registros use unique inline IDs inside one monthly document per Concurso. See `docs/leif-markdown.md`.
- Obsidian review rules: no `globalThis` (use `window` or bare globals), no `document.createElement` (use `createEl`), no `async onload` (use a void `onload` that delegates to `initialize`).
- `tests/ReleaseReadiness.test.ts` is a hard contract covering README headings, manifest/`versions.json` sync, the minimum Obsidian API, the command surface, and the release workflow. Update it deliberately when those surfaces change.
- `tests/ui/styles.test.ts` enforces the shared table readability rules (no ellipsis/clipping, name cells wrap at word boundaries, status and numeric cells stay on one line, sticky opaque Actions column, compact-pane touch targets). Edit `styles.css` together with those assertions.

## Release flow

1. Bump `manifest.json` and `package.json` (including the lockfile), and add `"<version>": "<minAppVersion>"` to `versions.json`.
2. Write `release-notes/<version>.md` (Portuguese) and add a `CHANGELOG.md` entry.
3. Make sure every `- ` bullet of `release-notes/<version>.md` appears verbatim in `src/releases/bundledReleases.ts` (the `scripts/verify-release.mjs` check).
4. Make sure `npm run release:check` passes.
5. Merge to `master`, create an annotated `<version>` tag, and push both — CI builds the plugin and publishes the GitHub release from the tag.
