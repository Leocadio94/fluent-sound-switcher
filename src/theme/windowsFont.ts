import type { Theme } from "@fluentui/react-components";

const FONT_BASE =
  '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif';

/**
 * Swaps Fluent's static "Segoe UI" for the Windows 11 shell face.
 * @see docs/visual-windows-11.md
 */
export function withWindowsFont(theme: Theme): Theme {
  return { ...theme, fontFamilyBase: FONT_BASE };
}
