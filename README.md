# Leif

**Your study compass.**

Leif is a plugin for [Obsidian](https://obsidian.md/) that organizes exam-prep study in a single panel. It brings together concursos, matérias, assuntos, recursos, and registros to show what to study now, and since 3.0 it stores everything as **open Markdown** in your vault.

## Features

- **Hoje** (Today): what to study now, following the active concurso's learner-controlled recommendation.
- **Concursos** (Contests): each concurso has its own cycle, matérias, and progress; switching between concursos is instant.
- **Matérias** (Subjects): organize the cycle's matérias, their assuntos, and recursos (PDFs, videos, links, question notebooks).
- **Recursos** (Resources): progress-bearing study sources with optional goals in pages, questions, lessons, or minutes.
- **Registros** (Records): independent dated study facts, editable one by one; saving never moves the cycle.
- **Mural** (Wall): readable Markdown reference area for the concurso — notes, links, and snapshots.

## Open Markdown, schema 2

In Leif 3.0, study content lives as readable Markdown under `Leif/concursos/<concurso>/`. Small files represent concursos, matérias, assuntos, recursos, and the mural; independent study records share one readable document per month. You can edit them in Obsidian, in another editor, or with an AI agent — with or without Obsidian running. Schema 2 is the only writable study authority; the previous mixed JSON/Markdown model is gone.

Leif watches vault events under `Leif/`, debounces batches, ignores `.staging/` and `.backups/`, and runs the same idempotent sync on startup so edits made while Obsidian was closed are canonicalized before you start working. Valid unlisted child documents receive a `leif-id` and are linked from their parent wikilink region automatically. Invalid or incomplete files are left untouched until you repair them.

For the schema reference, see [`docs/leif-markdown.md`](docs/leif-markdown.md). For hand-editing workflows (create, copy, rename, reparent, reorder, delete, diagnose), see [`docs/manual-editing.md`](docs/manual-editing.md). For migration and recovery, see [`docs/migration-and-recovery.md`](docs/migration-and-recovery.md). The domain language lives in [`CONTEXT.md`](CONTEXT.md).

## Installation

### From Obsidian

Once Leif is available in the official directory, open **Settings → Community plugins → Browse**, search for **Leif**, select **Install**, and then **Enable**.

### Manual install

1. Download `main.js`, `manifest.json`, and `styles.css` from the same release on the releases page.
2. Create the folder `<your-vault>/.obsidian/plugins/leif` and place the three files in it.
3. Restart Obsidian or reload plugins under **Settings → Community plugins**.
4. Enable **Leif**.

## Usage

Enable Leif under **Community plugins** and open the panel from the ribbon icon or the **Abrir painel** command. Create a concurso, organize its matérias and recursos, save independent study records, and check **Hoje** for the current recommendation.

The command palette offers:

- **Abrir painel**, **Abrir Hoje**, **Novos registros de estudo**, **Registrar estudo recomendado**, **Avançar recomendação**
- **Validar Markdown**, **Validar e sincronizar Markdown**, **Abrir relatório de diagnósticos**
- **Criar backup agora**, **Recuperar backup**

## Privacy

Data stays locally in the vault. Leif requires no account, sends no telemetry, and makes no network requests.

## Development

```bash
npm install
npm run dev             # watch-mode build
npm test                # tests
npm run release:check   # lint, tests, format, build, and release verification
```

## License

Distributed under the MIT license. See [LICENSE](LICENSE).
