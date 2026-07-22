# Changelog

Todas as mudanças notáveis do Leif são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [2.0.2] - 2026-07-22

### Corrigido

- Resumo do ciclo em Matérias agora separa Matérias, No ciclo e Tempo total com espaço e chips estilizados, e a duração aparece em horas e minutos (ex.: 2h 20min) em vez de minutos crus.
- O status No ciclo das matérias não quebra mais em duas linhas.
- Nos Registros, o item atual aparece como subtítulo de Agora, e o rótulo do próximo passo passou de "Depois vem" para "Depois:".

## [2.0.1] - 2026-07-22

### Corrigido

- Avisos da revisão de plugins do Obsidian: checksums passam a usar o `crypto` global compatível com janelas popout, modais criam elementos com o helper `createEl`, o `onload` deixa de ser assíncrono e delega para `initialize`, e uma asserção de tipo desnecessária é removida do armazenamento.

### Alterado

- README reescrito em inglês para o diretório oficial de plugins.
- Contrato de armazenamento Markdown sincronizado com a implementação: layout real do vault, os oito tipos `leif-type`, as regiões gerenciadas e o formato `^leif-ref-<hex>` dos block IDs.
- Repositório ganha `AGENTS.md` com orientações para agentes de IA: comandos, estrutura, convenções e fluxo de release.

## [2.0.0] - 2026-07-22

### Adicionado

- Conteúdo de estudo como Markdown aberto e legível no vault, em `Leif/concursos/<concurso>/`, com arquivos pequenos para concursos, matérias, itens, assuntos, recursos, mural e registros mensais.
- Migração opcional por concurso, com prévia dos arquivos e dos diagnósticos antes da confirmação.
- Backup completo e verificado por checksum em `Leif/.backups/upgrades/` antes da primeira escrita do v2 em instalações existentes; se o backup não puder ser relido, a inicialização é interrompida antes de qualquer escrita.
- Escritas serializadas em `Leif/.staging/`, com releitura do Markdown e comparação de campos, relações e ordens antes da ativação.
- Recibos de segurança de migração para auditoria do que foi validado e ativado.
- Rollback protegido ao JSON legado pelo comando **Leif: Voltar concurso ativo ao JSON legado**, permitido somente quando o snapshot legado ainda corresponde ao checksum original; os arquivos Markdown nunca são apagados.
- Guias de workspace para agentes em `Leif/AGENTS.md` e modelos em `Leif/templates/`, permitindo que pessoas e agentes de IA editem os mesmos arquivos sem executar o Obsidian, preservando `leif-id`, block IDs `^leif-ref-...` e regiões `<!-- leif:... -->`.
- Notas de versão exibidas uma vez após cada atualização.
- Área de estudo com visual nativo do Obsidian e design system próprio, com a recomendação do que estudar conectada aos registros e avanço do ciclo atômico no mesmo gesto.

### Alterado

- Estilização alinhada ao Obsidian: cabeçalho do painel simplificado, ações secundárias consolidadas e textos auxiliares persistentes removidos.
- A versão mínima suportada e verificada passa a ser Obsidian 1.5.7.
- Após a ativação do Markdown, o JSON legado é mantido apenas para recuperação e deixa de receber escrita dupla do conteúdo.

### Corrigido

- Mutações de persistência serializadas e atualizações relacionais atômicas, eliminando gravações parciais.
- Ordenações antigas normalizadas sem alterar a sequência efetiva, e campos do mural alinhados ao modelo atual.
- Detecção de downgrade e de divergência do JSON legado em relação ao Markdown.
- Escrita cancelada quando uma pessoa, agente, Git ou sync altera a fonte durante o staging; a edição externa permanece intacta.
- Migração retomada após interrupção, recuperação de ativação interrompida e acesso a pastas ocultas de migração.
- Dados v1 incompletos preservados para reparo em vez de descartados.
- Bloqueios de segurança reportados em português no painel.
- Prévia de migração compacta, abas de navegação sem interferência do tema, progresso de assuntos e posições de reordenação em uma única linha, e estados de data e pendências mais claros.

[2.0.2]: https://github.com/ttusk/leif/compare/2.0.1...2.0.2
[2.0.1]: https://github.com/ttusk/leif/compare/2.0.0...2.0.1
[2.0.0]: https://github.com/ttusk/leif/compare/1.0.2...2.0.0
