/**
 * Centralized ID factory. Uses crypto.randomUUID when available and falls back
 * to a Date.now() + Math.random() combination so two IDs generated in the same
 * millisecond never collide.
 */
export function createId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  return `${prefix}-${suffix}`;
}
