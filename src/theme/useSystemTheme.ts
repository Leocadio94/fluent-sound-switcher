import { useEffect, useState } from "react";
import {
  webLightTheme,
  webDarkTheme,
  type Theme,
} from "@fluentui/react-components";

export type ThemePreference = "system" | "light" | "dark";

function resolve(pref: ThemePreference, systemDark: boolean): Theme {
  if (pref === "light") return webLightTheme;
  if (pref === "dark") return webDarkTheme;
  return systemDark ? webDarkTheme : webLightTheme;
}

/**
 * Resolves the active Fluent theme from a preference, following the OS color
 * scheme when set to "system" so the app stays consistent with Windows 11.
 */
export function useSystemTheme(pref: ThemePreference): Theme {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return resolve(pref, systemDark);
}
