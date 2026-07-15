# Leif — Improvements Audit (UI & Code Quality)

**Date:** 2026-07-02
**Mode:** Static audit of `src/` at v0.1.0 (adapted from QA — no build changes to smoke-test; findings derived from reading source, tests and build config, with key claims verified by re-reading the cited files).
**Priorities:** P1 = high (correctness/safety/a11y), P2 = medium, P3 = low/polish.

---

## UI improvements

### P1 — Accessibility needs a fresh post-inline audit
- The primary tab bar now uses `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, and keyboard navigation.
- Creation and deletion flows now happen inline in the Leif view; the previous modal/confirm paths were removed.
- Remaining work: audit every inline form for labels, focus order, validation messaging, and keyboard-only delete confirmation.

### P2 — Mobile/responsive not implemented
- Only one `@media` query in the whole stylesheet; the inline-editable tables with per-cell inputs will overflow on phones. README roadmap lists "Revisar a experiência mobile" but it is not done.

### P2 — No localization layer
- ~66 hardcoded Portuguese strings in `src/ui/` (e.g. "Cancelar", "Salvar", "Excluir", "Nenhum concurso ativo"). No `t()` function, no locale bundle.
- `pt-BR` locale hardcoded in `SessionsTab.ts:161,268` and `ExportToCsvUseCase.ts:46`.

### P2 — Inconsistent error UX
- `notifyError` is copy-pasted into 6 components; only `CycleTab` and `WallTab` special-case `NoActiveContestError` with a friendlier message, the other four surface the raw error message. Inconsistent behavior for the same condition.

### P2 — Weak input validation in the UI
- Wall form builds links with only an `input.type="url"` HTML hint and no use-case validation (`UpdateContestWallValidator` only checks `contestId`).
- Item create form has no numeric bounds on `weight`/`questionCount`/`totalPages`.
- Business rule "a questions session must have count > 0" is enforced by throwing `ValidationError` from the view (`SessionsTab.ts:299-301`) — should live in the use case.

### P3 — Command-name language is inconsistent
- The open-view command is Portuguese ("Abrir painel do Leif") while the other 14 commands are English ("Show active contest", "Advance cycle"). Pick one convention.

### P3 — Icon-only buttons rely on tooltips
- `setTooltip`/`button.title` is fine for mouse users but weak for assistive tech without `aria-label`.

---

## Code quality improvements

### P1 — Architecture: application layer depends on a infrastructure concrete class
- `EntityRepository` (infrastructure) is imported directly into ~18 use cases (e.g. `src/application/use-cases/CreateContestUseCase.ts:4`). There is **no port** for it in `application/ports/`, so the dependency-inversion that the rest of the layering aims for is broken — the application layer is not portable off the current store.

### P1 — Cascade deletes leave orphaned IDs
- `DeleteStudyItemUseCase` removes the item but does **not** remove its id from `subject.itemIds`; `DeleteTopicUseCase` leaves the id in `subject.topicIds`; `DeleteContestUseCase` leaves orphaned subjects/items/topics/sessions behind. This silently corrupts referential integrity over time. No test asserts this behavior.

### P2 — Dead code: three domain services are unused in production
- `SubjectService`, `StudySessionService`, and `QuestionNotebookService` are only exercised by tests; their logic is **re-implemented inline** in the use cases (e.g. notebook stats in `RegisterStudySessionUseCase.ts:66-90` and `DeleteStudySessionUseCase.ts:39-58`). Either wire the services in or delete them and drop the tests.

### P2 — Duplication
- `notifyError` exists in 6 components **and** as `DomHelpers.notifyError` (a third copy the components don't use).
- `getSelectedSubject` + `renderSubjectPicker` are duplicated verbatim in `ItemsTab.ts` and `TopicsTab.ts`, with a third variant in `LeifView.ts:217-227`.
- `LeifTabId` and `TABS` are declared twice — once in `src/ui/constants/index.ts:33,35` (with icons) and again in `src/ui/view/LeifView.ts:15,29` (without icons). The constants version is unused.
- Question-notebook add/remove-stats logic is duplicated between `QuestionNotebookService` and the two session use cases.

### P2 — Error-handling inconsistency
- `ReorderSubjectsUseCase.ts:37,44` and `AdvanceCycleUseCase.ts:41` throw **plain `Error`** instead of `ValidationError`, so callers cannot distinguish domain from system errors.
- Validation logic lives in **four** places: entity constructors, `InputValidators` classes, inline checks in the `Update*` use cases, and `StudySessionService.validateSession` (unused).
- No centralized error boundary — every UI handler repeats try/catch + `notifyError`.

### P2 — ID generation is collision-prone
- `Date.now()`-based IDs in 7 places (e.g. `SessionsTab.ts:308`, `ItemsTab.ts`, `TopicsTab.ts`, `CycleTab.ts`, `registerCommands.ts`). Two entities created in the same millisecond collide. Only `CreateStudyItemUseCase.ts:43` adds a `Math.random()` suffix, and only when `id` is omitted. Standardize on a single ID factory.

### P2 — Tooling gaps
- **No linter/formatter**: no eslint, no prettier, no `.eslintrc`, no `lint` script in `package.json`.
- **CI has no lint step** and runs only on `master` (`ci.yml:4-7`); feature branches get no CI unless PR-targeted. No coverage upload.
- `tsconfig.json` is `strict` (good) but omits `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noUncheckedIndexedAccess` — the latter would flag the `EntityRepository` casts below.

### P2 — Test gaps
- No tests for: `ExportToCsvUseCase`, `UpdateContestWallUseCase` (only indirect), `ObsidianStorageAdapter`, `DataMigrations` (the v1→v2/v2→v3 no-ops and the dedup guard are untested), `DomHelpers`, `Seeder` (only indirect).
- The dead domain services are **over-tested** while the actually-wired paths have thinner coverage.
- Delete-cascade orphan behavior is not asserted anywhere.
- Duplicate `it()` name in `tests/ui/LeifView.test.ts:402` and `:487`.
- `tests/ui/styles.test.ts` is a single brittle regex check on `styles.css`.

### P3 — Typing holes
- `Contest.ts:11` types the wall arrays as `any[]` even though `Wall`/`WallLink`/`WallSubjectSnapshot` domain classes exist.
- `DataMigrations.ts:58,84,94` uses `any` for the migration input/output.
- `EntityRepository.ts` uses `as unknown as T[]` in 6 places (`:26,43,54,67,88,109`) plus a dubious `as unknown as T[] = entities` assignment at `:127`.

### P3 — Misc
- Two version fields coexist: `version: 1` (literal) and `schemaVersion` — confusing; pick one.
- Raw magic string `"questions"` is used instead of `StudySessionType.QUESTIONS` in `RegisterStudySessionUseCase.ts:67`, `DeleteStudySessionUseCase.ts:40`, and `QuestionNotebookService.ts:15,41`.
- Wall-link IDs are templated as `${contest.id}-notice`/`${contest.id}-exam` in both `Seeder.ts` and `WallTab.ts` — duplicated literal.

---

## Suggested fix order

1. **P1 cascade deletes** — make `Delete*` use cases clean up parent ID arrays; add regression tests. (smallest blast radius for a correctness bug)
2. **P1 architecture** — introduce an `EntityRepository` port in `application/ports/` and have use cases depend on the interface.
3. **P1 a11y basics** — audit inline form focus order, validation copy, and keyboard-only delete confirmation after the modal removal.
4. **P2 tooling** — add eslint + prettier, a `lint` script, and a lint step in CI; tighten `tsconfig` flags.
5. **P2 dead code & duplication** — either wire the three domain services into the use cases (and delete the inline copies) or remove them and their tests; extract a shared `notifyError`/`SubjectPicker`/`ID factory`.
6. **P2 error handling** — make all use cases throw `ValidationError` for domain failures; centralize validation; add one error boundary in the view.
7. **P2 test gaps** — cover `ExportToCsv`, migrations, `ObsidianStorageAdapter`, `DomHelpers`, and cascade-delete behavior; fix the duplicate test name.
8. **P3** — type the `Wall`, remove `any` in migrations, fix the `EntityRepository` casts with a typed accessor, unify version fields, replace magic strings.
