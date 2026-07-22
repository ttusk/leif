# Leif

**Your study compass.**

Leif is a plugin for [Obsidian](https://obsidian.md/) that organizes exam-prep study in a single panel. It brings together contests, subjects, syllabus topics, study resources, and study sessions to show what to study now — and since version 2.0, it stores content as **open Markdown** inside your vault.

## Features

- **Hoje** (Today): what to study now, following the active contest's cycle. Recording a session and advancing the cycle happen in one gesture.
- **Concursos** (Contests): each contest has its own cycle, subjects, and progress; switching between contests is instant.
- **Matérias** (Subjects): organize the cycle's subjects, the syllabus topics, and study resources (PDFs, videos, and links).
- **Registros** (Records): the history of every study session, with direct visual feedback in the panel.
- **Mural** (Wall): official links and planning notes for the contest, always at hand.

## Open Markdown

Since Leif 2.0, study content can live as readable Markdown in the vault, under `Leif/concursos/<contest>/` — small files for contests, subjects, study items, topics, resources, the wall, and monthly session records. You can edit them in Obsidian, in another editor, or with an AI agent, with or without Obsidian running.

Existing contests keep using the legacy store until you opt in, per contest: select the contest and run **Leif: Migrar concurso ativo para Markdown** from the command palette.

Before the first v2 write on an existing installation, Leif creates and reads back a complete backup identified by checksum in `Leif/.backups/upgrades/`. If that file cannot be verified, the plugin stops startup before registering any interface that could alter data.

Before switching the source, Leif:

1. shows a preview of the files and of the problems that would block migration;
2. validates IDs and relationships without changing data;
3. creates an immutable, checksummed backup in `Leif/.backups/`;
4. writes the files into `Leif/.staging/`;
5. rereads the Markdown and compares every field, relation, and order;
6. activates Markdown only if the projection is equivalent.

Leif also creates `Leif/AGENTS.md` and templates in `Leif/templates/`. Agents can edit the same files without running Obsidian, as long as they preserve `leif-id`, `^leif-ref-...` block IDs, and `<!-- leif:... -->` regions. Prose, unknown properties, and notes outside managed regions are preserved.

Documents with duplicate IDs, merge conflicts, invalid relations, or future schemas are blocked from writing. If a person, agent, Git, or sync changes the source during staging, the write is cancelled and the external edit stays intact. A later change to the legacy JSON is detected as a possible downgrade or sync conflict.

For recovery, run **Leif: Voltar concurso ativo ao JSON legado**. Rollback is only allowed while the legacy snapshot still matches the original checksum and never deletes the Markdown files.

## Installation

### From Obsidian

Once Leif is available in the official directory, open **Settings → Community plugins → Browse**, search for **Leif**, select **Install**, and then **Enable**.

### Manual install

1. Download `main.js`, `manifest.json`, and `styles.css` from the same release on the releases page.
2. Create the folder `<your-vault>/.obsidian/plugins/leif` and place the three files in it.
3. Restart Obsidian or reload plugins under **Settings → Community plugins**.
4. Enable **Leif**.

## Usage

Enable Leif under **Community plugins** and open the panel from the ribbon icon or the **Abrir painel** command. Create a contest, organize its subjects and resources, record each session, and check **Hoje** to follow the cycle.

## Privacy

Data stays locally in the vault. Leif requires no account, sends no telemetry, and makes no network requests.

## Development

```bash
npm install
npm run dev             # watch-mode build
npm test                # tests
npm run release:check   # lint, tests, format, build, and release verification
```

## Documentation

- [Markdown storage contract](docs/markdown-storage-v1.md)
- [ADR: Markdown is the study content authority](docs/adr/0001-markdown-is-the-study-content-authority.md)
- [Design system](docs/design-system.md)
- [Changelog](CHANGELOG.md)

## License

Distributed under the MIT license. See [LICENSE](LICENSE).