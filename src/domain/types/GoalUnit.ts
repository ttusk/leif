/**
 * Measurable units for resource goals and study records.
 * Values are Portuguese because they appear verbatim in Markdown files.
 */
export const GoalUnit = {
  PAGINAS: "paginas",
  QUESTOES: "questoes",
  AULAS: "aulas",
  MINUTOS: "minutos"
} as const;

export type GoalUnit = (typeof GoalUnit)[keyof typeof GoalUnit];

export const GOAL_UNITS: readonly GoalUnit[] = Object.values(GoalUnit);

export function isGoalUnit(value: string): value is GoalUnit {
  return (GOAL_UNITS as readonly string[]).includes(value);
}
