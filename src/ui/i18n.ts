/**
 * Minimal i18n layer. Strings live in a single pt-BR bundle; `t()` looks
 * them up by key. Unknown keys fall back to the key itself so missing entries
 * are obvious during development without throwing.
 *
 * The bundle is intentionally a plain object so it can grow without extra
 * tooling. Keep keys grouped by feature so the table stays scannable.
 */

const ptBR = {
  "command.openView": "Abrir painel do Leif",
  "command.showActiveContest": "Mostrar concurso ativo",
  "command.seedDemoData": "Criar dados de demonstração",
  "command.switchActiveContest": "Trocar concurso ativo",
  "command.showActiveContestSubjects": "Mostrar matérias do concurso ativo",
  "command.reorderActiveContestSubjects": "Reordenar matérias do concurso ativo",
  "command.toggleFirstSubjectActive": "Ativar/desativar primeira matéria",
  "command.updateFirstSubjectConfig": "Atualizar configuração da primeira matéria",
  "command.advanceCycle": "Avançar ciclo",
  "command.showCycleSnapshot": "Mostrar estado do ciclo",
  "command.showActiveContestWall": "Mostrar mural do concurso ativo",
  "command.showActiveContestSummary": "Mostrar resumo do concurso ativo",
  "command.registerDemoQuestionSession": "Registrar sessão de questões de demonstração",
  "command.registerDemoVideoSession": "Registrar sessão de vídeo de demonstração",
  "command.resetPluginData": "Redefinir dados do plugin",

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
