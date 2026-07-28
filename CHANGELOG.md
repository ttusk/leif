# Changelog

Todas as mudanças notáveis do Leif são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [3.0.2] - 2026-07-28

### Corrigido

- Ativação do Leif 3 agora aceita recursos legados com total de páginas ou questões igual a zero, preservando o formato e tratando a meta desconhecida como ausente.
- Seletor global de concurso usa o menu nativo do Obsidian, sem manter o menu customizado da interface anterior.
- Gerenciamento de concursos usa tabela legível, coluna Ações fixa e menu nativo com edição explícita.
- Exclusões de concurso, sessão, recurso e assunto agora identificam o alvo e pedem confirmação antes de remover dados.

## [3.0.1] - 2026-07-28

### Corrigido

- Mural em modo leitura agora descarrega o componente anterior do MarkdownRenderer antes de renderizar novamente, evitando assinaturas acumuladas entre atualizações.
- Atualização de painéis abertos usa o tipo da LeifView diretamente antes de chamar render, mantendo o refresh compatível com a API do Obsidian.
- Seletor de recuperação usa createDiv para respeitar as regras de revisão de plugins do Obsidian.

### Internas

- Ajustes de tipagem evitam interfaces vazias e casts opcionais desnecessários na migração de dados.
- Mock de testes do Obsidian passa a cobrir createDiv.

## [3.0.0] - 2026-07-27

### Markdown schema 2 como única autoridade de estudo

- O Markdown legível (schema 2) passa a ser a única autoridade gravável de conteúdo de estudo; o data.json mantém apenas estado operacional (seleção ativa, reconhecimento do changelog, recibos de migração e recuperação).
- Novas instalações e novos concursos já nascem diretamente em Markdown.
- Concursos em JSON legado e em Markdown schema 1 migrados automaticamente na inicialização, por concurso, com backup imutável, leitura semântica e recibos started/migrated/failed.
- Falha de migração isola o concurso afetado como somente leitura com diagnósticos em português; os demais concursos seguem funcionando.

### Domínio simplificado

- Recurso é a unidade de progresso do estudo, com meta opcional em paginas, questoes, aulas ou minutos, e pode cobrir zero, um ou vários assuntos.
- Acesso é um link leve (URL ou arquivo do vault) pertencente a um Recurso, sem identidade de progresso.
- Sessão de estudo agrupa um ou mais registros de estudo ordenados; salvar a sessão persiste registros e avanço do ciclo atomicamente.
- O ciclo rotaciona matérias ativas e recomenda o primeiro recurso incompleto; assuntos não adicionam outro nível de ciclo.

### Interface com padrões nativos do Obsidian

- Hoje e Registros compartilham o mesmo texto simples Agora / Próxima / Motivo, sem o Fio do ciclo nem marcadores de linha do tempo.
- Registros é uma lista agrupada por sessão, com ações de sessão em menu nativo do Obsidian e editor agregado que salva a sessão inteira de uma vez.
- Matérias, Recursos, Assuntos e Mural reformulados como tabelas e listas legíveis com coluna Ações fixa e opaca, nomes que quebram apenas entre palavras e células numéricas e de status em uma linha.
- Mural renderizado com MarkdownRenderer em modo leitura, com modo de edição explícito que só atualiza as notas e preserva o Markdown do usuário.

### Sincronização de edições externas

- Observador de eventos do vault em Leif/, com debounce, ignorando .staging/, .backups/ e Leif/diagnosticos.md, e supressão de eventos de escrita própria para evitar laços de feedback.
- Sincronização na inicialização para edições feitas enquanto o Obsidian estava fechado.
- Documentos filho válidos sem leif-id recebem um novo ID e são vinculados à região wikilink do pai na próxima sincronização.
- Leif/diagnosticos.md reescrito com carimbo, código estável, severidade, caminho, explicação em português e reparo concreto; um diagnóstico limpo reescreve o relatório como sucesso.

### Comandos e recuperação

- Paleta de comandos final: Abrir painel, Abrir Hoje, Nova sessão de estudo, Registrar estudo recomendado, Avançar ciclo sem registrar, Validar Markdown, Validar e sincronizar Markdown, Abrir relatório de diagnósticos, Criar backup agora, Recuperar backup.
- Backup manual em Leif/.backups/manual-<timestamp>/manifest.json e seletor de recuperação que restaura backups compatíveis em staging e nunca reativa JSON como autoridade gravável.
- Sem caminho de reversão para JSON: nenhuma superfície de comando restaura a autoridade legada.

### Documentação pública

- docs/leif-markdown.md como referência autoritativa do schema 2.
- docs/manual-editing.md com fluxos de criação, cópia, renomeação, reparenteamento, reordenação, exclusão e diagnóstico.
- docs/migration-and-recovery.md com migração automática, falhas somente leitura, backups e política sem reversão para JSON.

### Internas

- Observador de eventos do Vault, sincronizador, projetor de schema 1, serviço de recuperação de backups, seletor de recuperação e paleta final de comandos cobertos por testes.
- Versão mínima suportada mantida em Obsidian 1.5.7; plugin permanece mobile-safe.

## [2.1.1] - 2026-07-22

### Corrigido

- Nos Registros, o próximo passo (Depois:) agora fica empilhado abaixo de Item: ao lado de Agora, em vez de alinhado à direita.

## [2.1.0] - 2026-07-22

### Resumo da era 2.0

Consolida as mudanças das versões 2.0.0 a 2.0.3:

- Armazenamento aberto em Markdown no vault, com migração opcional por concurso e prévia dos arquivos.
- Backup completo verificado por checksum antes da primeira escrita do v2; falha interrompe a inicialização antes de registrar a interface.
- Escritas em staging com releitura e comparação antes de ativar o Markdown; corridas de escrita são abortadas.
- Rollback protegido ao JSON legado, permitido só com checksum íntegro; arquivos Markdown nunca são apagados.
- Guias para agentes em Leif/AGENTS.md e modelos em Leif/templates/.
- Notas de versão mostradas uma vez após cada atualização.
- Workspace de estudo com visual nativo do Obsidian e design system próprio.
- Avisos da revisão de plugins do Obsidian corrigidos e README em inglês.
- Resumo do ciclo e status das matérias mais legíveis.
- Versão mínima suportada: Obsidian 1.5.7.

### Documentação

- Novo guia de migração do v1 para o v2 em docs/v2-migration.md.

## [2.0.3] - 2026-07-22

### Alterado

- README mantém o inglês como idioma principal do texto, preservando apenas os rótulos reais da interface em português.

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

[3.0.1]: https://github.com/ttusk/leif/compare/3.0.0...3.0.1
[3.0.0]: https://github.com/ttusk/leif/compare/2.1.1...3.0.0
[2.1.1]: https://github.com/ttusk/leif/compare/2.1.0...2.1.1
[2.1.0]: https://github.com/ttusk/leif/compare/2.0.3...2.1.0
[2.0.3]: https://github.com/ttusk/leif/compare/2.0.2...2.0.3
[2.0.2]: https://github.com/ttusk/leif/compare/2.0.1...2.0.2
[2.0.1]: https://github.com/ttusk/leif/compare/2.0.0...2.0.1
[2.0.0]: https://github.com/ttusk/leif/compare/1.0.2...2.0.0
