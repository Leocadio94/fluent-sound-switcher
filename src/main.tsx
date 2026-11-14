import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { getCurrentWindow } from "@tauri-apps/api/window";

import App from "./App";
import Overlay from "./views/Overlay";
import FlyoutHost from "./views/FlyoutHost";
import Banner from "./views/Banner";
import { useSystemTheme, type ThemePreference } from "./theme/useSystemTheme";
import { useAccentTheme } from "./theme/useAccentTheme";
import {
  loadLanguage,
  loadTheme,
  loadTitleBarStyle,
  loadUseSystemAccent,
  loadWindowMaterial,
  saveTheme,
  saveTitleBarStyle,
  saveUseSystemAccent,
  saveWindowMaterial,
  type TitleBarStyle,
  type WindowMaterial,
} from "./lib/config";
import { setTitleBarStyle, setWindowMaterial } from "./lib/tauri";
import { applyMainWindowChrome, syncWindowTheme } from "./theme/windowChrome";
import i18n from "./i18n";
import "./styles.css";

/** Pins the document color-scheme so WebView2 doesn't auto-darken controls. */
function useColorScheme(isDark: boolean) {
  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);
}

interface WindowProps {
  themePref: ThemePreference;
  accent: boolean;
  titleBar: TitleBarStyle;
}

/** The main window's backdrop: the stored choice and what Windows really drew. */
interface MainChrome {
  material: WindowMaterial;
  applied: WindowMaterial;
}

const SOLID_CHROME: MainChrome = { material: "solid", applied: "solid" };

function Root({
  themePref: initialTheme,
  accent: initialAccent,
  titleBar: initialTitleBar,
  chrome,
}: WindowProps & { chrome: MainChrome }) {
  const [themePref, setThemePref] = useState<ThemePreference>(initialTheme);
  const [useSystemAccent, setUseSystemAccent] = useState(initialAccent);
  const [titleBarStyle, setTitleBar] = useState<TitleBarStyle>(initialTitleBar);
  const [material, setMaterial] = useState(chrome.material);
  const [appliedMaterial, setAppliedMaterial] = useState(chrome.applied);
  const themes = useAccentTheme(useSystemAccent);
  const { theme, isDark } = useSystemTheme(themePref, themes);
  useColorScheme(isDark);

  // Persist both: they used to live only in component state and reset to the
  // defaults on every launch.
  const changeTheme = useCallback((pref: ThemePreference) => {
    setThemePref(pref);
    void saveTheme(pref);
    void syncWindowTheme(pref);
  }, []);

  // `appliedMaterial`, not `material`, decides whether the page paints: the
  // window is transparent, so a backdrop the OS refused must not be assumed.
  const changeMaterial = useCallback((value: WindowMaterial) => {
    setMaterial(value);
    void saveWindowMaterial(value);
    void setWindowMaterial(value)
      .then(setAppliedMaterial)
      .catch((e) => {
        console.error("could not change the window material", e);
        setAppliedMaterial("solid");
      });
  }, []);

  const changeAccent = useCallback((value: boolean) => {
    setUseSystemAccent(value);
    void saveUseSystemAccent(value);
  }, []);

  // Applied live: the backend toggles the window decorations, so the choice
  // does not need a restart the way VS Code's does.
  const changeTitleBar = useCallback((value: TitleBarStyle) => {
    setTitleBar(value);
    void saveTitleBarStyle(value);
    void setTitleBarStyle(value).catch((e) =>
      console.error("could not change the title bar style", e),
    );
  }, []);

  return (
    <FluentProvider
      theme={theme}
      style={{
        height: "100vh",
        background: appliedMaterial === "solid" ? undefined : "transparent",
      }}
    >
      <App
        themePref={themePref}
        onThemePrefChange={changeTheme}
        useSystemAccent={useSystemAccent}
        onUseSystemAccentChange={changeAccent}
        titleBarStyle={titleBarStyle}
        onTitleBarStyleChange={changeTitleBar}
        windowMaterial={material}
        onWindowMaterialChange={changeMaterial}
        translucent={appliedMaterial !== "solid"}
      />
    </FluentProvider>
  );
}

/**
 * Shared shell for the three transparent auxiliary windows. Each one resolves
 * the theme itself: they are separate webviews, so they cannot read the main
 * window's React state.
 */
function AuxWindow({
  themePref,
  accent,
  children,
}: WindowProps & { children: React.ReactNode }) {
  const themes = useAccentTheme(accent);
  const { theme, isDark } = useSystemTheme(themePref, themes);
  useColorScheme(isDark);
  return (
    <FluentProvider theme={theme} style={{ background: "transparent" }}>
      {children}
    </FluentProvider>
  );
}

const label = getCurrentWindow().label;
// Lets CSS scope transparent/centered styling to the auxiliary windows only,
// so the global bundle doesn't shrink the main window.
document.documentElement.dataset.window = label;

function content(props: WindowProps, chrome: MainChrome) {
  switch (label) {
    case "overlay":
      return (
        <AuxWindow {...props}>
          <Overlay />
        </AuxWindow>
      );
    case "flyout":
      return (
        <AuxWindow {...props}>
          <FlyoutHost />
        </AuxWindow>
      );
    case "banner":
      return (
        <AuxWindow {...props}>
          <Banner />
        </AuxWindow>
      );
    default:
      return <Root {...props} chrome={chrome} />;
  }
}

/**
 * Reads the persisted language, theme and accent preference *before* the first
 * render.
 *
 * Language and theme used to live in component state only, so they reset on
 * every launch, and the auxiliary windows hardcoded "system" regardless of the
 * choice. Awaiting here costs one small file read and avoids a flash of the
 * wrong language or palette: the main window stays hidden until React reports
 * its first frame anyway.
 */
async function bootstrap() {
  const [language, theme, accent, titleBar, material] = await Promise.all([
    loadLanguage().catch(() => null),
    loadTheme().catch(() => null),
    loadUseSystemAccent().catch(() => true),
    loadTitleBarStyle().catch(() => "custom" as TitleBarStyle),
    loadWindowMaterial().catch(() => "solid" as WindowMaterial),
  ]);

  if (language && language !== i18n.language) {
    await i18n.changeLanguage(language);
  } else {
    // No stored preference: still sync <html lang> with the default.
    document.documentElement.lang = i18n.language;
  }

  const props: WindowProps = {
    themePref: (theme ?? "system") as ThemePreference,
    accent,
    titleBar,
  };

  // Before the first render, so the hidden main window already has its
  // backdrop when it is revealed. The auxiliary windows have none.
  const chrome: MainChrome =
    label === "main"
      ? { material, applied: await applyMainWindowChrome(props.themePref, material) }
      : SOLID_CHROME;

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>{content(props, chrome)}</React.StrictMode>,
  );
}

void bootstrap();
