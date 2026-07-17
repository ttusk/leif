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

export type LeifTabId = "dashboard" | "contests" | "cycle" | "items" | "topics" | "sessions" | "wall";

export const TABS: Array<{ id: LeifTabId; label: string; icon: string }> = [
  { id: "dashboard", label: t("tab.dashboard"), icon: ICON_NAMES.dashboard },
  { id: "sessions", label: t("tab.sessions"), icon: ICON_NAMES.sessions },
  { id: "cycle", label: t("tab.cycle"), icon: ICON_NAMES.cycle },
  { id: "topics", label: t("tab.topics"), icon: ICON_NAMES.topics },
  { id: "items", label: t("tab.items"), icon: ICON_NAMES.items },
  { id: "contests", label: t("tab.contests"), icon: ICON_NAMES.contests },
  { id: "wall", label: t("tab.wall"), icon: ICON_NAMES.wall }
];
