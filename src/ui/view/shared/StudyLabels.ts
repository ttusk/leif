import type { GoalUnit } from "@/domain/types/GoalUnit";

const GOAL_UNIT_LABELS: Record<GoalUnit, string> = {
  paginas: "Páginas",
  questoes: "Questões",
  aulas: "Aulas",
  minutos: "Minutos"
};

const ACTIVITY_LABELS: Record<string, string> = {
  aula: "Aula",
  leitura: "Leitura",
  questoes: "Questões",
  revisao: "Revisão",
  video: "Vídeo"
};

export function goalUnitOptions(): Array<[GoalUnit, string]> {
  return Object.entries(GOAL_UNIT_LABELS) as Array<[GoalUnit, string]>;
}

export function formatGoalQuantity(amount: number, unit: GoalUnit): string {
  return `${amount} ${GOAL_UNIT_LABELS[unit].toLocaleLowerCase("pt-BR")}`;
}

export function formatActivity(activity: string): string {
  const normalized = activity.trim();
  return (
    ACTIVITY_LABELS[normalized.toLocaleLowerCase("pt-BR")] ??
    normalized.replace(/^./u, (character) => character.toLocaleUpperCase("pt-BR"))
  );
}
