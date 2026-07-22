import type { MarkdownFile } from "@/infrastructure/markdown/MarkdownContestBundleCodec";

export const MARKDOWN_WORKSPACE_FILES: readonly MarkdownFile[] = [
  {
    path: "Leif/README.md",
    content: `# Leif

Este diretório guarda conteúdo de estudo em Markdown aberto. Você pode editar os arquivos no Obsidian, em outro editor ou com um agente de IA.

## Regras rápidas

- Caminhos e nomes de arquivo podem mudar; \`leif-id\` é a identidade estável.
- A posição nas listas gerenciadas define a ordem.
- Leif preserva texto fora de regiões \`<!-- leif:... -->\`.
- Não edite quando houver marcadores de conflito do Git/sync.
- Consulte [[AGENTS]] antes de automatizar alterações.
`
  },
  {
    path: "Leif/AGENTS.md",
    content: `# Working with Leif Markdown

These files are a public interoperability contract for humans and AI harnesses.

1. Read the closest document before editing related files.
2. Never change a \`leif-id\` after creation. Generate a collision-resistant ID for new records.
3. Preserve unknown frontmatter properties, prose, comments, and sections.
4. Edit structured lists only inside matching \`<!-- leif:name:start -->\` and \`<!-- leif:name:end -->\` markers.
5. Keep exactly one ordered marker pair per managed region. List position is the order.
6. Preserve every \`^leif-ref-...\` block ID. Do not guess a missing parent or identity.
7. Stop if you find duplicate IDs, malformed regions, a future \`leif-schema\`, or Git/sync conflict markers.
8. Make the smallest targeted edit and reread the changed document before finishing.
9. Create uncertain content as an ordinary draft outside managed regions; do not fabricate Leif relationships.
10. Never edit \`.backups\` or \`.staging\`.
`
  },
  {
    path: "Leif/templates/concurso.md",
    content: `---
leif-type: concurso
leif-schema: 1
leif-id: REPLACE-WITH-STABLE-ID
name: "Nome do concurso"
---
# Nome do concurso

<!-- leif:subjects:start -->
<!-- leif:subjects:end -->

<!-- leif:wall-notes:start -->
<!-- leif:wall-notes:end -->
`
  },
  {
    path: "Leif/templates/materia.md",
    content: `---
leif-type: materia
leif-schema: 1
leif-id: REPLACE-WITH-STABLE-ID
contest-id: REPLACE-WITH-CONTEST-ID
name: "Nome da matéria"
active: true
planned-minutes: 60
---
# Nome da matéria

<!-- leif:items:start -->
<!-- leif:items:end -->

<!-- leif:topics:start -->
<!-- leif:topics:end -->
`
  },
  {
    path: "Leif/templates/registro.md",
    content: `---
leif-type: registro
leif-schema: 1
leif-id: REPLACE-WITH-STABLE-ID
contest-id: REPLACE-WITH-CONTEST-ID
type: questions
studied-at: "2026-01-01T12:00:00.000Z"
subject-id: REPLACE-WITH-SUBJECT-ID
count: 20
correct: 16
completed: true
---
# Registro de estudo
`
  }
];
