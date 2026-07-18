/**
 * Minimal i18n layer. Strings live in a single pt-BR bundle; `t()` looks
 * them up by key. Unknown keys fall back to the key itself so missing entries
 * are obvious during development without throwing.
 *
 * The bundle is intentionally a plain object so it can grow without extra
 * tooling. Keep keys grouped by feature so the table stays scannable.
 */

const ptBR = {
  "command.openView": "Abrir painel",

  "tab.dashboard": "Hoje",
  "tab.contests": "Concursos",
  "tab.cycle": "Matérias",
  "tab.items": "Recursos",
  "tab.topics": "Edital",
  "tab.sessions": "Registros",
  "tab.wall": "Mural",

  "action.cancel": "Cancelar",
  "action.save": "Salvar",
  "action.delete": "Excluir",
  "action.edit": "Editar",
  "action.create": "Criar",
  "action.confirm": "Confirmar",
  "action.close": "Fechar"
} as const;

export type TranslationKey = keyof typeof ptBR;

const bundle: Record<string, string> = ptBR as unknown as Record<string, string>;

export function t(key: TranslationKey): string {
  return bundle[key] ?? key;
}
