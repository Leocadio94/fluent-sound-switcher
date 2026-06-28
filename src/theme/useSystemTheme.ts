import { useEffect, useState } from "react";
import {
  webLightTheme,
  webDarkTheme,
  type Theme,
} from "@fluentui/react-components";

export type ThemePreference = "system" | "light" | "dark";

export interface ResolvedTheme {
  theme: Theme;
  isDark: boolean;
}

/**
 * Resolves the active Fluent theme from a preference, following the OS color
 * scheme when set to "system" so the app stays consistent with Windows 11.
 *
 * Also reports `isDark` so the caller can pin the document `color-scheme`:
 * without it WebView2 applies its own auto-dark heuristic and renders some
 * controls (e.g. dropdowns) with a light background in dark mode.
 */
export function useSystemTheme(pref: ThemePreference): ResolvedTheme {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const isDark = pref === "dark" || (pref === "system" && systemDark);
  return { theme: isDark ? webDarkTheme : webLightTheme, isDark };
}
