import type { BundledReleaseNote } from "@/application/services/ChangelogService";

export const BUNDLED_RELEASES: readonly BundledReleaseNote[] = [
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
