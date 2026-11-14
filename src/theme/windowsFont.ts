import type { Theme } from "@fluentui/react-components";

/**
 * Windows 11's own UI face. Fluent's web themes ask for the static "Segoe UI",
 * which is what Windows 10 used; "Segoe UI Variable Text" is what the rest of
 * the shell draws with, and falls back to the old name on older systems.
 */
const FONT_BASE =
  '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif';

export function withWindowsFont(theme: Theme): Theme {
  return { ...theme, fontFamilyBase: FONT_BASE };
}
