import type { BundledReleaseNote } from "@/application/services/ChangelogService";

export const BUNDLED_RELEASES: readonly BundledReleaseNote[] = [
  {
    version: "2.0.0",
    title: "Leif 2.0",
    body: `## Markdown aberto, com migração segura

- Conteúdo de estudo pode viver como Markdown legível no vault.
- Migração é opcional por concurso, cria backup e verifica equivalência antes da troca.
- Escritas são serializadas e falhas não deixam snapshots pela metade.
- Documentos com IDs duplicados, conflitos de merge ou schemas futuros ficam bloqueados para escrita, sem descarte silencioso.
- Leif agora mostra estas notas uma vez após cada atualização.`,
    githubUrl: "https://github.com/ttusk/leif/releases/tag/2.0.0"
  }
];
