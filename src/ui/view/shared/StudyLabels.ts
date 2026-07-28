import type { GoalUnit } from "@/domain/types/GoalUnit";

const GOAL_UNIT_LABELS: Record<GoalUnit, string> = {
  paginas: "Páginas",
  questoes: "Questões",
  aulas: "Aulas",
  minutos: "Minutos"
};

export function goalUnitOptions(): Array<[GoalUnit, string]> {
  return Object.entries(GOAL_UNIT_LABELS) as Array<[GoalUnit, string]>;
}

export function formatGoalQuantity(amount: number, unit: GoalUnit): string {
  return `${amount} ${GOAL_UNIT_LABELS[unit].toLocaleLowerCase("pt-BR")}`;
}
