# Leif Native design system

Status: approved implementation contract for Leif v2.

Leif is a focused study workspace for Brazilian concurseiros who already live in Obsidian. Its interface should feel like an Obsidian view that understands concursos, not a separate web application embedded inside Obsidian.

The primary job of the interface is to answer three questions quickly:

1. What should I study now?
2. Why is this the next useful step?
3. What changed after I studied it?

## Product language

- The interface is Portuguese-only in v2.
- Use the domain terms `concurso`, `matéria`, `assunto`, `recurso`, `registro`, `plano`, `ciclo`, and `mural` consistently.
- Use sentence case.
- Prefer direct verbs: `Registrar estudo`, `Salvar alterações`, `Avançar sem registrar`.
- Do not use implementation terms such as schema, index, repository, projection, or migration receipt in normal UI.
- Guidance is contextual. Persistent explanatory paragraphs should not repeat what a clear heading or label already says.
- Errors state what happened and what the user can do next. They do not apologize or discard the user's input.

## Design principles

### Obsidian supplies the brand

Leif inherits the active Obsidian theme, font, density, control appearance, focus treatment, and color mode. Leif adds study-specific information architecture and state, not a parallel visual identity.

### Structure before decoration

Use proximity, alignment, typography, and sparse dividers before adding a background, border, radius, or shadow. A bounded surface must communicate one of three things: current context, editable state, or a scroll boundary.

### One primary action

Each screen has at most one visually primary contextual action. Secondary actions stay as normal buttons, links, or an overflow menu. Destructive actions never compete visually with the primary workflow.

### State is factual

Leif explains recommendations with a short factual reason derived from the study state. It must not invent motivational language or present uncertain recommendations as intelligent conclusions.

### Content remains readable

Study notes and Markdown are content, not form decoration. Mural is read-first; editing is an explicit temporary mode. Dense comparison data may use a table, while ordinary records use divided rows.

## Foundation tokens

Production CSS always aliases Obsidian variables. The hex values below are only a reference snapshot of the default dark appearance for design discussion and visual regression calibration. They must never be shipped as Leif color declarations.

| Role | Reference | Production alias |
| --- | --- | --- |
| Canvas | `#202020` | `var(--background-primary)` |
| Muted surface | `#262626` | `var(--background-secondary)` |
| Primary text | `#dcddde` | `var(--text-normal)` |
| Muted text | `#999999` | `var(--text-muted)` |
| Accent | `#7f6df2` | `var(--interactive-accent)` |
| Danger | `#e93147` | `var(--text-error)` |

The Leif aliases are semantic and intentionally small:

```css
.leif-view {
  --leif-bg: var(--background-primary);
  --leif-bg-muted: var(--background-secondary);
  --leif-bg-editing: var(--background-primary-alt);
  --leif-border: var(--background-modifier-border);
  --leif-border-hover: var(--background-modifier-border-hover);
  --leif-text: var(--text-normal);
  --leif-text-muted: var(--text-muted);
  --leif-accent: var(--interactive-accent);
  --leif-focus: var(--background-modifier-border-focus);
  --leif-success: var(--text-success);
  --leif-warning: var(--text-warning);
  --leif-danger: var(--text-error);
}
```

Do not introduce Leif-specific density settings. Use Obsidian's spacing scale:

| Purpose | Token |
| --- | --- |
| Icon/text gap | `var(--size-4-1)` |
| Compact row gap | `var(--size-4-2)` |
| Field and local group gap | `var(--size-4-3)` |
| Section gap | `var(--size-4-4)` |
| Major separation | `var(--size-4-6)` |

Use `var(--radius-s)` for the rare bounded surface. Use the radius already supplied by native inputs and buttons. Main-view surfaces do not use shadows.

## Typography

No font files or custom font-family stacks belong in Leif.

| Role | Family | Size | Treatment |
| --- | --- | --- | --- |
| Screen title | `var(--font-interface)` | 18–20px | `var(--font-semibold)`, tight line height |
| Section title | `var(--font-interface)` | `var(--font-ui-medium)` | `var(--font-semibold)` |
| UI body | `var(--font-interface)` | `var(--font-ui-small)` | normal |
| Metadata and labels | `var(--font-interface)` | `var(--font-ui-smaller)` | muted; medium or semibold only when needed |
| Mural prose | `var(--font-text)` | inherited Markdown size | rendered using Obsidian Markdown conventions |
| Numeric data | inherited | inherited | `font-variant-numeric: tabular-nums` |

Do not use oversized dashboard typography, decorative display faces, all-uppercase eyebrow labels, or letter spacing as ornament. Uppercase remains valid for real abbreviations such as `PDF`.

## Information architecture

Leif has four primary tabs:

1. `Hoje`
2. `Registros`
3. `Plano`
4. `Mural`

`Plano` contains three subsections:

1. `Matérias`
2. `Edital`
3. `Recursos`

`Concursos` is not a primary tab. The active concurso is global context and is selected from the view toolbar. Contest creation, editing, and deletion open from that selector or its adjacent menu.

Opening a new Leif view always starts on `Hoje`. Changing the active concurso also returns to `Hoje`, clears stale subject or row selection, and announces the new context to assistive technology.

## Shell

Leif preserves Obsidian's existing `view-content` class and adds `leif-view`; it never replaces host classes. The shell has no duplicate Leif logo, brand tile, marketing header, or static status badge.

Wide pane:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Concurso  TRT 6ª Região ▾                              [context menu] │
│                                                                      │
│ Hoje        Registros        Plano        Mural                      │
│ ━━━                                                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ screen content                                                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

The global context row is a compact toolbar. The concurso control is interactive; it must not look like a badge if clicking it changes context.

The four primary tabs remain visible as text on ordinary panes. They form one horizontal, scrollable row with a bottom active rule. Icons are optional and secondary to labels. `Plano` subsections use a quieter nested switcher and never compete with primary navigation.

## Hoje

`Hoje` is an operational page, not an analytics dashboard. It shows, in order:

1. Active concurso and exam timing.
2. The next recommended study action.
3. A factual, one-line reason for the recommendation.
4. A compact subject summary.

```text
Hoje

TRT 6ª Região                                      Prova em 42 dias
14 de setembro de 2026

Próximo estudo
│ Português                                               60 min
│ Sintaxe · PDF
│ Motivo: é a próxima matéria ativa no ciclo.
│
│ [Registrar estudo]
│ Avançar sem registrar

Resumo por matéria
──────────────────────────────────────────────────────────────
Português          18 sessões        120/310 pág.        78%
Dir. Constitucional 9 sessões          80 questões       71%
```

The recommendation is visually important through position and the `Fio do ciclo`, not through a large hero card. The primary action is `Registrar estudo`. `Avançar sem registrar` is a secondary action and requires explicit confirmation if advancing would discard meaningful current progress.

The reason line uses known facts, for example:

- `é a próxima matéria ativa no ciclo.`
- `continua o recurso iniciado no último registro.`
- `é o primeiro recurso pendente desta matéria.`
- `não há outro recurso ativo nesta matéria.`

Do not use claims such as `melhor escolha`, `ideal para você`, or `recomendado pela IA` unless a future product capability can explain and verify them.

### Exam date states

| Input state | Hoje display | Behavior |
| --- | --- | --- |
| Valid future date | `Prova em 42 dias` plus localized date | Countdown uses the user's local calendar date |
| Today | `Prova hoje` plus localized date | Never display `0 dias` |
| Past date | `Prova realizada em 14/09/2025` | Never display a negative countdown |
| Missing date | `Data da prova não definida` | Secondary link goes to `Plano` when appropriate |
| Invalid stored value | `Data da prova inválida` | No countdown; expose a repair action in `Plano` and a diagnostic notice |

Date parsing must not rely on UTC conversion that can move the exam to the previous day in Brazil.

## Fio do ciclo

`Fio do ciclo` is Leif's one signature element. It expresses ordered study state rather than decorating a generic card.

The domain structure is a semantic ordered list:

```html
<ol class="leif-cycle-thread" aria-label="Ordem do ciclo de estudos">
  <li class="is-current" aria-current="step">...</li>
  <li class="is-next">...</li>
  <li class="is-later">...</li>
</ol>
```

Presentation uses a 2px line based on `var(--interactive-accent)`. The current step has the strongest marker, the next step has a muted marker, and later steps remain structurally visible without accent emphasis.

Rules:

- Current, next, and later are always distinguishable by text or accessible name, not color alone.
- The line follows the logical block direction and supports right-to-left layout even though v2 copy is Portuguese.
- `aria-current="step"` appears exactly once when a current step exists.
- An empty cycle renders guidance instead of an empty decorative line.
- Long titles wrap without moving the marker away from the first line.
- Reduced-motion mode removes any transition on state changes.
- The same state vocabulary is used on `Hoje`, the current row in `Plano > Matérias`, and the recommendation context in `Registros`.

## Registros

Opening `Registros` from the recommendation pre-fills the active concurso, recommended matéria, recommended recurso, expected study type, and planned duration when those values exist.

```text
Registros                                      [+ Novo registro]

Registrar estudo
│ Português · Sintaxe
│ [Tipo: PDF ▾] [Páginas ____] [Concluído ✓]
│ [Observações ________________________________________]
│                                      [Registrar estudo]

Histórico
Filtros: [Matéria ▾] [Tipo ▾] [De] [Até]
──────────────────────────────────────────────────────────────
Hoje 14:30    Português · Sintaxe    20 páginas          [⋯]
Ontem         Constitucional         15/20 questões      [⋯]
```

When a saved record matches the current recommendation and is marked complete, Leif advances the cycle atomically after persistence succeeds. A native notice confirms the result and offers `Desfazer`.

A matching record means:

- same active concurso;
- same current matéria;
- same recommended recurso when the recommendation identifies one; and
- `completed: true`.

If the recommendation changed while the form was open, save the valid record but do not advance automatically. Explain that the cycle changed and leave it untouched. An incomplete record never advances the cycle.

`Avançar sem registrar` remains available as a secondary action from the recommendation context. It must not create an empty or synthetic study record.

During submission:

- Keep all entered values in the DOM.
- Set the form or submit control to `aria-busy="true"`.
- Disable duplicate submission while leaving navigation and cancel behavior deliberate.
- Change the primary label to a factual pending label such as `Registrando…`.
- Advance only after durable save succeeds.
- On failure, re-enable submission, keep every invalid or unsaved value, focus or link to the inline error, and do not advance.

## Plano

`Plano` groups the configuration that determines the recommendation. Its subsection selection may persist while the view remains open, but a new view starts at `Matérias`.

```text
Plano
Matérias        Edital        Recursos
━━━━━━━

Matérias                                           [+ Nova matéria]
────────────────────────────────────────────────────────────────
1  Português              Atual · 60 min · PDF               [⋯]
2  Dir. Constitucional    Próxima · 45 min                    [⋯]
3  Informática            Depois · pausada                    [⋯]
```

Order is human-facing and one-based. Reordering preserves focus and announces the new position. The current row uses the `Fio do ciclo` state, not a filled card.

Secondary row actions belong in an overflow menu: edit, pause/activate, move to position, and delete. A frequently repeated primary row action may remain visible only when evidence shows that hiding it slows the core workflow. Touch users must never depend on hover.

Destructive deletion opens a native Obsidian modal that identifies the entity and any cascading effect. The default focused action is safe. Success uses a native notice.

## Mural

Mural is a readable reference page first. It should resemble an Obsidian note with useful metadata, not a permanently open settings form.

```text
Mural                                                   [Editar]

Notas
Priorizar legislação seca nas duas últimas semanas.

Referências
──────────────────────────────────────────────────────────────
Edital       Edital de abertura                    [Abrir ↗]
Prova        Prova anterior — FCC                  [Abrir ↗]

Resumo das matérias
Português          Peso 2       Pontuação 8       Sintaxe
Constitucional     Peso 1       Pontuação 6       Direitos
```

Selecting `Editar` changes only the affected sections into native fields. Corresponding Edital and Prova fields align through one shared field component, not through theme-dependent `.setting-item` markup. Save is the single primary action; cancel is secondary. Invalid input remains visible with an inline error.

Free-form notes render with Obsidian's Markdown renderer in read mode. Links use normal Obsidian external-link behavior and clear accessible names.

## First run and empty states

First run is a short, actionable setup rather than a centered illustration or welcome dashboard:

```text
Começar no Leif

1. Criar ou escolher um concurso                  [Escolher]
2. Adicionar as matérias do edital                [Adicionar]
3. Definir o primeiro recurso                     [Definir]
```

Each step reflects actual persisted state and links to the exact screen needed to complete it. Completed steps stay visible but subdued until setup is complete. The list never claims completion before durable save.

Later empty states are local and contextual:

- State the missing object: `Nenhuma matéria ativa.`
- Explain one consequence only: `O ciclo precisa de uma matéria ativa para recomendar o próximo estudo.`
- Offer the direct action when the user can resolve it.
- Do not add dashed drop zones, decorative icons, inspirational copy, or generic `Nada por aqui` messages.

## Component contracts

### `LeifShell`

- Preserves host classes on `contentEl` and adds `leif-view`.
- Owns global concurso selection, primary navigation, and active panel.
- Starts on `Hoje` for each new view.
- Returns to `Hoje` on concurso change.
- Uses pane width, not application window width, for responsive state.

### `ContestSelector`

- Is an interactive native select, menu trigger, or button with popup semantics.
- Displays the active concurso without a decorative badge.
- Includes create/manage access without making `Concursos` a primary tab.
- Announces context changes and prevents selection of an invalid or unavailable concurso.

### `PrimaryNavigation`

- Contains exactly `Hoje`, `Registros`, `Plano`, and `Mural` in v2.
- Uses semantic tabs because it swaps a panel in the same view.
- Supports Left/Right, Home/End, Enter/Space, roving tabindex, and visible focus.
- Keeps the active tab visible when the row scrolls.

### `PageHeader`

- Contains one screen title and an optional contextual action area.
- Does not repeat the product name.
- Does not require a descriptive paragraph.

### `Section`

- Is transparent by default.
- May have a sparse top or bottom divider between peer sections.
- Receives a background only for current context or editability.

### `CycleThread`

- Renders a semantic ordered list.
- Accepts explicit `current`, `next`, and `later` states.
- Guarantees no more than one current step.
- Exposes the recommendation reason adjacent to the current step.

### `Field`

- Has a programmatically associated label, optional description, control, and inline error.
- Uses stacked layout for long inputs, URLs, and textareas.
- Uses a compact label/control row only for short scalar controls when space permits.
- Preserves user input on validation and persistence errors.
- Uses `aria-invalid` and `aria-describedby` when invalid.

### `ActionBar`

- Contains at most one `mod-cta` action.
- Places the primary action last in reading order for left-to-right layout.
- Keeps cancel and secondary actions visually quiet.
- Reflects pending submission and blocks duplicate execution.

### `DataTable`

- Is reserved for comparison across consistent columns.
- Provides a caption or accessible name and `scope="col"` headers.
- Right-aligns numeric columns and uses tabular numerals.
- Has a stable action column and an accessible compact-mode alternative.

### `RecordRow`

- Uses sparse dividers rather than a card per row.
- Keeps its primary label and outcome visible.
- Puts secondary actions in a native overflow menu.
- Does not hide required actions from keyboard or touch users.

### `InlineStatus`

- Always includes meaningful text.
- May use success, warning, or danger color as reinforcement, never as the only signal.
- Is not a pill unless it acts as an interactive filter.

### `NativeNotice`

- Confirms short-lived success or failure using Obsidian Notice.
- May offer `Desfazer` after cycle advancement.
- Does not replace persistent inline errors that require action.

### `DestructiveConfirmModal`

- Uses Obsidian's native Modal patterns and focus management.
- Names the target and describes cascading deletion.
- Makes the safe action the default and styles only the destructive confirmation as dangerous.

### `ChangelogModal`

- Renders bundled release notes through Obsidian's Markdown renderer.
- Uses native heading, list, link, button, scrolling, and modal spacing.
- Has no release hero, gradient, feature cards, confetti, or remote content.
- Offers `Fechar` and a normal link to the matching GitHub release.
- Appears once per update and records acknowledgement only after explicit close.

## Feedback and error behavior

- Use a native notice for completed actions that require no further work.
- Use an inline error next to the relevant field or section when the user must act.
- Preserve invalid input and selection after re-render.
- Move focus to the first invalid control only after submit, never while typing.
- Include an error summary for forms with multiple invalid fields.
- Do not clear a form until persistence succeeds.
- Disable duplicate submission with an explicit pending state.
- If the underlying Markdown changed concurrently, keep the form values, stop the write, explain the conflict, and offer reload or copy options.
- Undo is offered only when the inverse operation remains safe against the current revision.

## Accessibility

- All interactive elements are native `button`, `a`, `input`, `select`, `textarea`, or equivalent Obsidian components.
- Icon-only actions have accessible names and Obsidian tooltips.
- Keyboard focus is visible in every theme.
- Primary and subsection navigation use correct tab, panel, and roving tabindex relationships.
- The vertical or horizontal orientation exposed to assistive technology matches the rendered navigation.
- `Fio do ciclo` uses `<ol>`, visible state text, and `aria-current="step"`.
- Tables have captions or accessible names, scoped headers, and sensible reading order.
- Status, accuracy, and progress never rely on color alone.
- Live announcements are polite and limited to meaningful context changes, saved state, reorder position, and errors.
- Modal focus is trapped and restored to the invoking control on close.
- Touch targets are at least 40px in compact/touch layouts unless the host theme supplies a larger target.
- `prefers-reduced-motion` removes nonessential transitions.
- Forced-colors mode preserves borders, current-step state, focus, and selection.
- Content remains usable at 200% zoom without two-dimensional page scrolling outside intentionally scrollable data tables.

## Responsive behavior

Leif responds to the Obsidian pane, not the browser viewport.

### Wide: more than 760px

- Horizontal primary navigation with labels.
- Single readable content column, approximately 880–960px maximum.
- Compact field rows may place related scalar controls side by side.
- Tables may keep comparison columns.

### Narrow: 521–760px

- Primary navigation scrolls horizontally and keeps labels.
- Multi-column fields become one or two columns based on their minimum usable width.
- Recommendation metadata stacks below its main label.
- Secondary actions move into overflow menus before content truncates.

### Compact: 520px or less

- Content uses Obsidian's compact pane padding.
- Four primary tabs remain identifiable; labels may shorten only if accessible names and tooltips remain complete.
- Forms become one column and primary actions fill available width when appropriate.
- Comparison tables switch to labeled record rows when horizontal scrolling would hide the relationship between label and value.
- Hover is never required.

Use one authoritative responsive mechanism. Prefer container queries or pane-width classes, with only a minimal compatibility fallback. Do not maintain three parallel copies of the same layout rules.

## Test plan

### Component contract tests

- `LeifShell` preserves `view-content` and adds `leif-view`.
- Primary navigation contains exactly four tabs in the approved order.
- `Plano` contains exactly the three approved subsections.
- A new view and concurso change both activate `Hoje`.
- The concurso selector is interactive and globally available.
- Forms expose one primary action and retain values after validation or save failure.
- Row secondary actions are reachable through an overflow button with an accessible name.

### Recommendation and cycle tests

- `Fio do ciclo` renders an ordered list with exactly one `aria-current="step"` when applicable.
- Current, next, and later states have visible textual equivalents.
- Registration opened from `Hoje` is prefilled from the current recommendation.
- A matching completed record saves and advances atomically.
- A nonmatching, stale, or incomplete record saves without advancing.
- Duplicate submit is blocked during pending persistence.
- Successful automatic advancement offers a safe undo.
- `Avançar sem registrar` advances without creating a study record.

### Date tests

- Future date uses a local-calendar countdown.
- Today's date says `Prova hoje`.
- Past date never produces a negative count.
- Missing date is neutral and actionable.
- Invalid date produces no countdown and preserves stored data for repair.
- Tests cover Brazil timezone boundaries around midnight.

### Accessibility tests

- Tab keyboard behavior includes arrows, Home/End, Enter/Space, and roving tabindex.
- Labels, descriptions, and inline errors are programmatically connected.
- Table headers have scope and tables have accessible names.
- Icon-only and overflow buttons have accessible names.
- Focus returns after menus and modals close.
- No state is encoded by color alone.
- Reduced-motion and forced-colors contracts remain present.

### Responsive and theme QA

- Test actual Obsidian panes at wide, narrow, and compact widths rather than viewport width alone.
- Smoke-test default light and dark themes.
- Smoke-test at least one high-density theme, one theme with unusual radii, and one theme with a monospaced interface font.
- Verify 200% zoom, keyboard-only navigation, and touch-sized controls.
- Capture visual references for `Hoje`, prefilled `Registros`, every `Plano` subsection, Mural read/edit modes, first run, inline error, pending save, destructive modal, and changelog.

CSS tests should assert semantic contracts, token usage, and prohibited hardcoded values. They should not pin exact selector text, arbitrary pixel values, or the previous layout.

## Staged implementation

### Stage 1 — Foundation

- Preserve Obsidian host classes on the view container.
- Establish the semantic token and typography contracts.
- Consolidate responsive behavior under one authority.
- Replace brittle CSS-string tests with behavioral design contracts.

### Stage 2 — Native shell

- Remove the duplicate Leif brand header and passive contest badge.
- Add the global interactive concurso selector and context menu.
- Reduce primary navigation to four tabs.
- Implement default-to-`Hoje` behavior on open and contest change.

### Stage 3 — Hoje and Fio do ciclo

- Replace generic dashboard panels with the flat operational layout.
- Implement the semantic ordered cycle thread.
- Add factual recommendation reasons and complete exam-date states.
- Convert subject summaries to compact comparison rows.

### Stage 4 — Registration workflow

- Prefill registration from the current recommendation.
- Add pending, inline error, stale-recommendation, atomic advance, and undo behavior.
- Add the secondary advance-without-recording flow.
- Move secondary history actions to overflow menus.

### Stage 5 — Plano

- Merge Matérias, Edital, and Recursos under the `Plano` subsection navigation.
- Apply one-based ordering and accessible reorder announcements.
- Replace per-row action clusters with overflow menus.
- Move destructive operations to native confirmation modals.

### Stage 6 — Mural

- Convert Mural to read-first Markdown presentation.
- Add explicit edit mode with one shared field primitive.
- Replace theme-dependent `.setting-item` form layout.
- Verify long URLs, missing links, invalid URLs, and compact-pane alignment.

### Stage 7 — Guidance and update surfaces

- Add the three-step first-run setup.
- Standardize local empty states, native notices, inline errors, and pending states.
- Render the changelog as a native Markdown modal.

### Stage 8 — Cross-theme QA and cleanup

- Remove obsolete card, badge, hero, sidebar, and duplicated responsive CSS.
- Run behavioral, accessibility, timezone, build, and release tests.
- Verify real Obsidian behavior in light, dark, compact, split-pane, and third-party theme scenarios.

Each stage should be independently releasable and should not require storage migration. Interaction changes that can affect cycle advancement require focused regression tests before visual cleanup proceeds.

## Anti-patterns

Do not add:

- A duplicate product header, logo tile, or slogan inside the Leif view.
- Gradients, glass effects, glowing accents, ambient backgrounds, or decorative blobs.
- Oversized hero text for the current subject or exam countdown.
- Grids of statistic cards when a compact row or sentence is clearer.
- Pills for every status or metadata value.
- Hardcoded colors, custom fonts, or a Leif density preference.
- Decorative leaf, compass, sparkle, robot, or AI iconography.
- Uppercase eyebrow labels used only for visual style.
- Numbered sections unless the order carries real domain meaning.
- Multiple `mod-cta` buttons in one screen context.
- Persistent helper prose beneath self-explanatory titles.
- Dashed empty-state cards, centered illustrations, or congratulatory confetti.
- Hover-only actions or color-only states.
- Inline destructive confirmations that shift the row layout.
- Theme-internal `.setting-item` layout outside a deliberate native settings context.
- Replacement of Obsidian-owned classes on `contentEl`.
- Runtime release-note fetching or a marketing-style changelog.

## Design critique

The earlier interface had already adopted Obsidian variables and native controls, but its composition still followed familiar generated-dashboard defaults: a branded application header, a passive context badge, an internal navigation rail, oversized focus panels, metric clusters, repeated rounded containers, and explanatory copy under most headings.

Those choices were removed because they described a generic productivity dashboard rather than Leif's study model. The approved direction spends its single distinctive gesture on the `Fio do ciclo`, where a visual mark communicates current, next, and later study state. Everything around it is deliberately quieter: host typography, host colors, flat sections, native controls, factual language, and sparse dividers.

This restraint is not the absence of a Leif identity. The ordered cycle, recommendation reason, prefilled record, and visible advancement are the identity. A user should recognize Leif by how naturally it turns a study plan into the next recorded action, while still feeling that they never left Obsidian.
