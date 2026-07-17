# Leif — Product Overview

**Date:** 2026-07-02
**Status:** Living document
**Version documented:** 0.1.0
**Perspective:** Product (what it does and why)

## What Leif is

Leif is a plugin for [Obsidian](https://obsidian.md/) that tracks study cycles for Brazilian public-competition exams (concursos públicos). Everything lives inside the user's Obsidian vault, replacing scattered spreadsheets and notes with one integrated panel.

## Problem it solves

Studying for a concurso means juggling many subjects, each with its own PDFs, videos, question notebooks and study sessions — often across several contests at once. The recurring pain points:

- Progress is tracked across multiple spreadsheets/notes that drift out of sync.
- "What should I study next?" must be re-decided every session.
- There is no single view connecting the rotation of subjects with the actual content (PDFs, question notebooks) and the sessions already done.

Leif addresses this by organizing study around the **contest**, recommending the next **subject** and **item**, and showing progress dashboards — all persisted in the vault as a single `data.json`.

## Background & status

- Personal project by Luiz Gustavo, MIT-licensed, v0.1.0, early development.
- Core features are implemented and unit-tested (~128 tests), but the plugin is **not yet published** to the official Obsidian community plugin list.
- Desktop and mobile are both intended (`isDesktopOnly: false`), though the mobile experience is on the roadmap and not yet validated.
- A ready-to-open demo vault (`sample-vault/`) ships with 3 seeded contests so the product can be tried without setup.

## Concepts (domain model)

| Concept | What it means |
|---|---|
| **Concurso** | The top-level unit of organization. Each contest owns its subjects, items, topics, sessions and a wall. |
| **Matéria (Subject)** | A discipline of the contest. Has an order, planned minutes, current stage, and can be active/inactive in the cycle. |
| **Item** | A unit of study inside a subject (e.g. a PDF module). Holds resource references (pdf/video/link) and a total-page count. |
| **Assunto (Topic)** | A sub-topic of a subject. Optionally holds one question notebook. |
| **Caderno de questões** | A question notebook linked to a topic, tracking solved questions and correct answers. |
| **Sessão** | A manual study record of type pdf, video or questions, optionally linked to an item and/or topic. |
| **Ciclo** | The rotation over active subjects, with a cursor pointing to the current subject and current item. |
| **Mural (Wall)** | Per-contest reference board: notice/exam links, notes, and read-only subject snapshots. |

Relationships are modeled by ID arrays (not object references), and all data is a single persisted aggregate (`LeifPluginData`).

## What the user can do

The plugin opens a side-panel view with **7 user-facing areas**:

| Tab | Capabilities |
|---|---|
| **Hoje** | Overview of the active contest: next study activity, planned duration/stage, what comes next, and a per-subject summary (sessions, PDF page progress bar, questions, accuracy). |
| **Registros** | Study-session history and cycle action: recommended subject/item context, "Marcar como estudado" button, last-10 sessions table with compact result cells, inline-create sessions, inline-edit count/correct, and inline delete confirmation. |
| **Matérias** | Study-cycle setup: list the active contest's subjects; inline-create and inline-edit planned minutes + stage; click a status cell to toggle active/inactive; reorder up/down next to the order number. |
| **Edital** | Syllabus/topic map: subject picker; simplified topics table; inline-create topics; inline-edit name + notebook stats; expandable row to link/edit a question notebook; inline delete confirmation. |
| **Recursos** | Study resources: subject picker; simplified resources table with page-progress bar and "✓ Concluído"; inline-create items; inline-edit title/weight/questions/total pages; expandable row to add pdf/video/link references; inline delete confirmation. |
| **Concursos** | Contest management: simplified list of contests; set the active contest; inline-create contests; inline-edit name + wall notes; inline delete confirmation. |
| **Mural** | Edit the active contest's notice link, exam link and notes; read-only subject snapshots table (subject, weight, score, target items). |

Additionally, **15 commands** are registered for the command palette (mostly demo/utility entry points today, e.g. `Leif: Seed demo data`, `Leif: Advance cycle`, `Leif: Reset plugin data`), plus `Leif: Abrir painel do Leif` to open the panel.

## Recommended user flow

1. Create or select a contest.
2. Register the contest's subjects.
3. Set each subject's order and active/inactive status in the cycle.
4. Register the study items for each subject (attach PDFs/videos/links).
5. Register topics and link question notebooks where relevant.
6. Register study sessions as you progress.
7. Use Hoje to decide what to study next and follow progress/performance.
8. When a subject's item is done, use "Finalizar ciclo atual" in Registros to advance to the next recommended subject/item.

## Persistence

- A single JSON file at `.obsidian/plugins/leif/data.json` written via Obsidian's `plugin.saveData()`.
- Loaded once on startup; a `PluginDataStore` merges defaults and runs migrations (currently no-op placeholders + a deduplication guard) before use.
- A generic `EntityRepository<T>` provides CRUD over the six entity arrays.

## Constraints

- Requires Obsidian 1.5.0+.
- Single vault, single `data.json` — no multi-vault sync, no cloud.
- Sessions are entered **manually** (no automatic timers, no automatic PDF-page tracking).
- CSV export only (no CSV import yet).
- Portuguese (pt-BR) UI; no localization layer.

## Out of scope / roadmap

From `README.md`:

- Publish to the Obsidian community plugin list.
- Add filters and search to the tables.
- Improve statistics visualization.
- Add CSV import.
- Review the mobile experience.
- Add screenshot documentation.

## Entry points for readers

- User-facing concepts & flow: `README.md` and the 7 tab files in `src/ui/view/components/`.
- Data model: `src/domain/types/LeifPluginData.ts` + entities in `src/domain/entities/`.
- Persistence format: `sample-vault/.obsidian/plugins/leif/data.json` (concrete example).
- Command surface: `src/ui/commands/registerCommands.ts`.
- Demo data shape: `src/infrastructure/persistence/Seeder.ts`.
