/**
 * UI Constants for the Leif plugin
 */

import { t } from "@/ui/i18n";

export const DATE_FORMAT = "dd/MM/yyyy";

/**
 * Icon names from Lucide icon library (built into Obsidian).
 * Browse available icons at: https://lucide.dev/
 */
export const ICON_NAMES = {
  dashboard: "calendar-check",
  contests: "trophy",
  cycle: "refresh-cw",
  items: "file-text",
  topics: "book-open",
  sessions: "clock",
  wall: "layout-grid",
  delete: "trash-2",
  add: "plus",
  edit: "pencil",
  save: "check",
  cancel: "x",
  up: "arrow-up",
  down: "arrow-down",
  toggleOn: "toggle-right",
  toggleOff: "toggle-left",
  expand: "chevron-down",
  collapse: "chevron-up",
  download: "download"
} as const;

export type LeifTabId =
  "dashboard" | "contests" | "cycle" | "items" | "topics" | "sessions" | "wall";

export type LeifPrimaryTabId = "dashboard" | "sessions" | "plan" | "wall";

export const PRIMARY_TABS: Array<{ id: LeifPrimaryTabId; label: string }> = [
  { id: "dashboard", label: t("tab.dashboard") },
  { id: "sessions", label: t("tab.sessions") },
  { id: "plan", label: "Plano" },
  { id: "wall", label: t("tab.wall") }
];

export const PLAN_TABS: Array<{
  id: Extract<LeifTabId, "cycle" | "topics" | "items">;
  label: string;
}> = [
  { id: "cycle", label: t("tab.cycle") },
  { id: "topics", label: t("tab.topics") },
  { id: "items", label: t("tab.items") }
];
