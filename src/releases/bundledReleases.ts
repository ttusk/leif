import type { BundledReleaseNote } from "@/application/services/ChangelogService";

export const BUNDLED_RELEASES: readonly BundledReleaseNote[] = [
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
