import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { getCurrentWindow } from "@tauri-apps/api/window";

import App from "./App";
import Overlay from "./views/Overlay";
import Flyout from "./views/Flyout";
import Banner from "./views/Banner";
import { useSystemTheme, type ThemePreference } from "./theme/useSystemTheme";
import { loadLanguage, loadTheme, saveTheme } from "./lib/config";
import i18n from "./i18n";
import "./styles.css";

/** Pins the document color-scheme so WebView2 doesn't auto-darken controls. */
function useColorScheme(isDark: boolean) {
  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);
}

function Root({ initialTheme }: { initialTheme: ThemePreference }) {
  const [themePref, setThemePref] = useState<ThemePreference>(initialTheme);
  const { theme, isDark } = useSystemTheme(themePref);
  useColorScheme(isDark);

  // Persist the choice: it used to live only in component state and reset to
  // "system" on every launch.
  const changeTheme = useCallback((pref: ThemePreference) => {
    setThemePref(pref);
    void saveTheme(pref);
  }, []);

  return (
    <FluentProvider theme={theme} style={{ height: "100vh" }}>
      <App themePref={themePref} onThemePrefChange={changeTheme} />
    </FluentProvider>
  );
}

/**
 * Themed wrapper for the click-through mute overlay. It used to render bare,
 * with its colours hardcoded in CSS, so it ignored the theme entirely.
 */
function OverlayRoot({ themePref }: { themePref: ThemePreference }) {
  const { theme, isDark } = useSystemTheme(themePref);
  useColorScheme(isDark);
  return (
    <FluentProvider theme={theme} style={{ background: "transparent" }}>
      <Overlay />
    </FluentProvider>
  );
}

/** Themed wrapper for the transparent tray flyout window. */
function FlyoutRoot({ themePref }: { themePref: ThemePreference }) {
  const { theme, isDark } = useSystemTheme(themePref);
  useColorScheme(isDark);
  return (
    <FluentProvider theme={theme} style={{ background: "transparent" }}>
      <Flyout />
    </FluentProvider>
  );
}

/** Themed wrapper for the transparent device-change banner window. */
function BannerRoot({ themePref }: { themePref: ThemePreference }) {
  const { theme, isDark } = useSystemTheme(themePref);
  useColorScheme(isDark);
  return (
    <FluentProvider theme={theme} style={{ background: "transparent" }}>
      <Banner />
    </FluentProvider>
  );
}

const label = getCurrentWindow().label;
// Lets CSS scope transparent/centered styling to the auxiliary windows only,
// so the global bundle doesn't shrink the main window.
document.documentElement.dataset.window = label;

function content(themePref: ThemePreference) {
  switch (label) {
    case "overlay":
      return <OverlayRoot themePref={themePref} />;
    case "flyout":
      return <FlyoutRoot themePref={themePref} />;
    case "banner":
      return <BannerRoot themePref={themePref} />;
    default:
      return <Root initialTheme={themePref} />;
  }
}

/**
 * Reads the persisted language and theme *before* the first render.
 *
 * Both used to live in component state only, so they reset on every launch, and
 * the auxiliary windows hardcoded "system" regardless of the choice. Awaiting
 * here costs one small file read and avoids a flash of the wrong language: the
 * main window stays hidden until React reports its first frame anyway.
 */
async function bootstrap() {
  const [language, theme] = await Promise.all([
    loadLanguage().catch(() => null),
    loadTheme().catch(() => null),
  ]);

  if (language && language !== i18n.language) {
    await i18n.changeLanguage(language);
  } else {
    // No stored preference: still sync <html lang> with the default.
    document.documentElement.lang = i18n.language;
  }

  const themePref = (theme ?? "system") as ThemePreference;

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>{content(themePref)}</React.StrictMode>,
  );
}

void bootstrap();
