import type { BundledReleaseNote } from "@/application/services/ChangelogService";

export const BUNDLED_RELEASES: readonly BundledReleaseNote[] = [
  {
    version: "3.0.1",
    title: "Leif 3.0.1",
    body: `## Corrigido

- Mural em modo leitura agora descarrega o componente anterior do MarkdownRenderer antes de renderizar novamente, evitando assinaturas acumuladas entre atualizações.
- Atualização de painéis abertos usa o tipo da LeifView diretamente antes de chamar render, mantendo o refresh compatível com a API do Obsidian.
- Seletor de recuperação usa createDiv para respeitar as regras de revisão de plugins do Obsidian.

## Internas

- Ajustes de tipagem evitam interfaces vazias e casts opcionais desnecessários na migração de dados.
- Mock de testes do Obsidian passa a cobrir createDiv.`,
    githubUrl: "https://github.com/ttusk/leif/releases/tag/3.0.1"
  },
  {
    version: "3.0.0",
    title: "Leif 3.0",
    body: `## Markdown schema 2 como única autoridade de estudo

- O Markdown legível (schema 2) passa a ser a única autoridade gravável de conteúdo de estudo; o data.json mantém apenas estado operacional (seleção ativa, reconhecimento do changelog, recibos de migração e recuperação).
- Novas instalações e novos concursos já nascem diretamente em Markdown.
- Concursos em JSON legado e em Markdown schema 1 migrados automaticamente na inicialização, por concurso, com backup imutável, leitura semântica e recibos started/migrated/failed.
- Falha de migração isola o concurso afetado como somente leitura com diagnósticos em português; os demais concursos seguem funcionando.

## Domínio simplificado

- Recurso é a unidade de progresso do estudo, com meta opcional em paginas, questoes, aulas ou minutos, e pode cobrir zero, um ou vários assuntos.
- Acesso é um link leve (URL ou arquivo do vault) pertencente a um Recurso, sem identidade de progresso.
- Sessão de estudo agrupa um ou mais registros de estudo ordenados; salvar a sessão persiste registros e avanço do ciclo atomicamente.
- O ciclo rotaciona matérias ativas e recomenda o primeiro recurso incompleto; assuntos não adicionam outro nível de ciclo.

## Interface com padrões nativos do Obsidian

- Hoje e Registros compartilham o mesmo texto simples Agora / Próxima / Motivo, sem o Fio do ciclo nem marcadores de linha do tempo.
- Registros é uma lista agrupada por sessão, com ações de sessão em menu nativo do Obsidian e editor agregado que salva a sessão inteira de uma vez.
- Matérias, Recursos, Assuntos e Mural reformulados como tabelas e listas legíveis com coluna Ações fixa e opaca, nomes que quebram apenas entre palavras e células numéricas e de status em uma linha.
- Mural renderizado com MarkdownRenderer em modo leitura, com modo de edição explícito que só atualiza as notas e preserva o Markdown do usuário.

## Sincronização de edições externas

- Observador de eventos do vault em Leif/, com debounce, ignorando .staging/, .backups/ e Leif/diagnosticos.md, e supressão de eventos de escrita própria para evitar laços de feedback.
- Sincronização na inicialização para edições feitas enquanto o Obsidian estava fechado.
- Documentos filho válidos sem leif-id recebem um novo ID e são vinculados à região wikilink do pai na próxima sincronização.
- Leif/diagnosticos.md reescrito com carimbo, código estável, severidade, caminho, explicação em português e reparo concreto; um diagnóstico limpo reescreve o relatório como sucesso.

## Comandos e recuperação

- Paleta de comandos final: Abrir painel, Abrir Hoje, Nova sessão de estudo, Registrar estudo recomendado, Avançar ciclo sem registrar, Validar Markdown, Validar e sincronizar Markdown, Abrir relatório de diagnósticos, Criar backup agora, Recuperar backup.
- Backup manual em Leif/.backups/manual-<timestamp>/manifest.json e seletor de recuperação que restaura backups compatíveis em staging e nunca reativa JSON como autoridade gravável.
- Sem caminho de reversão para JSON: nenhuma superfície de comando restaura a autoridade legada.

## Documentação pública

- docs/leif-markdown.md como referência autoritativa do schema 2.
- docs/manual-editing.md com fluxos de criação, cópia, renomeação, reparenteamento, reordenação, exclusão e diagnóstico.
- docs/migration-and-recovery.md com migração automática, falhas somente leitura, backups e política sem reversão para JSON.

## Internas

- Observador de eventos do Vault, sincronizador, projetor de schema 1, serviço de recuperação de backups, seletor de recuperação e paleta final de comandos cobertos por testes.
- Versão mínima suportada mantida em Obsidian 1.5.7; plugin permanece mobile-safe.`,
    githubUrl: "https://github.com/ttusk/leif/releases/tag/3.0.0"
  },
  {
    version: "2.1.1",
    title: "Leif 2.1.1",
    body: `## Corrigido

- Nos Registros, o próximo passo (Depois:) agora fica empilhado abaixo de Item: ao lado de Agora, em vez de alinhado à direita.`,
    githubUrl: "https://github.com/ttusk/leif/releases/tag/2.1.1"
  },
  {
    version: "2.1.0",
    title: "Leif 2.1",
    body: `## Resumo da era 2.0

- Armazenamento aberto em Markdown no vault, com migração opcional por concurso e prévia dos arquivos.
- Backup completo verificado por checksum antes da primeira escrita do v2; falha interrompe a inicialização antes de registrar a interface.
- Escritas em staging com releitura e comparação antes de ativar o Markdown; corridas de escrita são abortadas em vez de sobrescrever.
- Rollback protegido ao JSON legado, permitido só com checksum íntegro; arquivos Markdown nunca são apagados.
- Guias para agentes em Leif/AGENTS.md e modelos em Leif/templates/.
- Notas de versão mostradas uma vez após cada atualização.
- Workspace de estudo com visual nativo do Obsidian e design system próprio.
- Avisos da revisão de plugins do Obsidian corrigidos e README em inglês.
- Resumo do ciclo e status das matérias mais legíveis.
- Versão mínima suportada: Obsidian 1.5.7.

## Como migrar do v1 para o v2

1. Atualize o plugin; o v1 continua funcionando sem mudança.
2. Abra a paleta de comandos e execute Migrar concurso ativo para Markdown.
3. Revise a prévia dos arquivos e dos diagnósticos que bloqueariam a migração.
4. Confirme: um backup imutável é criado, os arquivos vão para staging e o Markdown só vira autoridade se for equivalente.
5. Em caso de erro, use Voltar concurso ativo ao JSON legado, desde que o snapshot legado ainda esteja intacto.
6. Antes de automatizar com agentes de IA, leia Leif/AGENTS.md e o guia completo em docs/v2-migration.md.`,
    githubUrl: "https://github.com/ttusk/leif/releases/tag/2.1.0"
  },
  {
    version: "2.0.3",
    title: "Leif 2.0.3",
    body: `## Documentação

- README agora mantém o inglês como idioma principal do texto, mantendo apenas os rótulos reais da interface em português.`,
    githubUrl: "https://github.com/ttusk/leif/releases/tag/2.0.3"
  },
  {
    version: "2.0.2",
    title: "Leif 2.0.2",
    body: `## Refinamentos visuais no plano e nos registros

- O resumo do ciclo em Matérias agora tem espaço entre Matérias, No ciclo e Tempo total, e o tempo total aparece em horas e minutos (ex.: 2h 20min) em vez de minutos crus.
- O status No ciclo das matérias não quebra mais em duas linhas.
- Nos Registros, o item atual aparece como subtítulo de Agora, e o próximo passo passou de Depois vem para Depois:.`,
    githubUrl: "https://github.com/ttusk/leif/releases/tag/2.0.2"
  },
  {
    version: "2.0.1",
    title: "Leif 2.0.1",
    body: `## Revisão da comunidade e documentação

- Código ajustado às regras de revisão de plugins do Obsidian: checksums usam o crypto global compatível com janelas popout, modais passam a criar elementos com o helper createEl e o carregamento do plugin deixa de usar onload assíncrono.
- README reescrito em inglês, preparado para o diretório oficial de plugins.
- Contrato do armazenamento Markdown atualizado com o layout real do vault, todos os tipos leif-type e o formato dos block IDs ^leif-ref-...
- O repositório ganha um AGENTS.md com comandos, estrutura e convenções para agentes de IA.`,
    githubUrl: "https://github.com/ttusk/leif/releases/tag/2.0.1"
  },
  {
    version: "2.0.0",
    title: "Leif 2.0",
    body: `## Markdown aberto, com migração segura

- Conteúdo de estudo pode viver como Markdown legível no vault.
- Instalações existentes recebem um backup completo e verificado antes da primeira escrita do v2.
- Migração é opcional por concurso e mostra uma prévia com arquivos e diagnósticos antes da confirmação.
- Escritas são serializadas, usam staging e abortam se uma pessoa, agente ou sync alterar a fonte durante a operação.
- Documentos com IDs duplicados, relações inválidas, conflitos de merge ou schemas futuros ficam bloqueados para escrita, sem descarte silencioso.
- O carregador preserva dados v1 incompletos para reparo e normaliza ordens antigas sem mudar a sequência efetiva.
- A versão mínima suportada e verificada passa a ser Obsidian 1.5.7.
- Leif agora mostra estas notas uma vez após cada atualização.`,
    githubUrl: "https://github.com/ttusk/leif/releases/tag/2.0.0"
  }
];
