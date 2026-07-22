# Leif

**Your study compass.**

Leif is a plugin for [Obsidian](https://obsidian.md/) that organizes concurso study in a single panel. It brings together concursos, matérias, edital assuntos, recursos, and registros de estudo to show what to study now — and since version 2.0, it stores content as **open Markdown** inside your vault.

## Features

- **Hoje**: the recommendation of what to study now, following the active concurso's cycle. Recording a study and advancing the cycle happen in one gesture.
- **Concursos**: each concurso has its own cycle, matérias, and progress; switching between concursos is instant.
- **Matérias**: organize the cycle's matérias, the edital's assuntos, and study recursos (PDFs, videos, and links).
- **Registros**: the history of every registro de estudo, with direct visual feedback in the panel.
- **Mural**: official links and planning notes for the concurso, always at hand.

## Open Markdown

Since Leif 2.0, study content can live as readable Markdown in the vault, under `Leif/concursos/<concurso>/` — small files for concursos, matérias, itens, assuntos, recursos, mural, and monthly registros. You can edit them in Obsidian, in another editor, or with an AI agent, with or without Obsidian running.

Existing concursos keep using the legacy store until you opt in, per concurso: select the concurso and run **Leif: Migrar concurso ativo para Markdown** from the command palette.

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

Enable Leif under **Community plugins** and open the panel from the ribbon icon or the **Abrir painel** command. Create a concurso, organize its matérias and recursos, record each study, and check **Hoje** to follow the cycle.

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
- [2.0 release notes](release-notes/2.0.0.md)

## License

Distributed under the MIT license. See [LICENSE](LICENSE).
