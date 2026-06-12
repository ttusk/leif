# Corvo

Corvo is an Obsidian plugin for managing study cycles for public exams.

## Stack

- TypeScript
- Obsidian API
- Vitest
- esbuild

## Architecture

- `src/domain`: core entities and domain services
- `src/application`: use case ports and data contracts
- `src/infrastructure`: adapters for Obsidian and persistence
- `src/ui`: plugin-facing commands, views, and settings

## Commands

- `npm install`
- `npm run build`
- `npm test`

## Sample Vault

A pre-configured test vault is available in `sample-vault/`. It contains:

- The Corvo plugin built and installed
- Pre-loaded demo data for the **TCE-SP 2026** contest
- 6 subjects, 15 study items, 7 topics, 30 study sessions
- A second contest (**SEFAZ-BA 2026**) for testing switching

### How to use the sample vault

1. Open Obsidian
2. Click "Open folder as vault"
3. Select the `sample-vault/` folder
4. The Corvo plugin will be already enabled
5. Click the raven icon in the left sidebar or use `Corvo: Abrir painel do Corvo`

## POC Commands

- `Corvo: Abrir painel do Corvo`
- `Corvo: Seed demo data`
- `Corvo: Show active contest`
- `Corvo: Switch active contest`
- `Corvo: Show active contest subjects`
- `Corvo: Reorder active contest subjects`
- `Corvo: Toggle first subject active state`
- `Corvo: Update first subject configuration`
- `Corvo: Advance cycle`
- `Corvo: Show cycle snapshot`
- `Corvo: Show active contest wall`
- `Corvo: Show active contest summary`
- `Corvo: Register demo question session`
- `Corvo: Register demo video session`
- `Corvo: Reset plugin data`

## UI

Corvo now includes a main Obsidian view with tabs for:

- `Dashboard`
- `Concursos`
- `Ciclo e Matérias`
- `Itens e PDFs`
- `Assuntos e Questões`
- `Sessões`
- `Mural`

Abra o Corvo pela faixa lateral esquerda, pela paleta de comandos com `Corvo: Abrir painel do Corvo` ou pelo botão da aba de configurações do plugin.
