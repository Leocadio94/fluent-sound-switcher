import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { getCurrentWindow } from "@tauri-apps/api/window";

import App from "./App";
import Overlay from "./views/Overlay";
import Flyout from "./views/Flyout";
import Banner from "./views/Banner";
import { useSystemTheme, type ThemePreference } from "./theme/useSystemTheme";
import "./i18n";
import "./styles.css";

function Root() {
  const [themePref, setThemePref] = useState<ThemePreference>("system");
  const { theme, isDark } = useSystemTheme(themePref);

  // Pin the document color-scheme so WebView2 doesn't auto-darken controls.
  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  return (
    <FluentProvider theme={theme} style={{ height: "100vh" }}>
      <App themePref={themePref} onThemePrefChange={setThemePref} />
    </FluentProvider>
  );
}

/** Themed wrapper for the transparent tray flyout window. */
function FlyoutRoot() {
  const { theme, isDark } = useSystemTheme("system");
  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);
  return (
    <FluentProvider theme={theme} style={{ background: "transparent" }}>
      <Flyout />
    </FluentProvider>
  );
}

/** Themed wrapper for the transparent device-change banner window. */
function BannerRoot() {
  const { theme, isDark } = useSystemTheme("system");
  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);
  return (
    <FluentProvider theme={theme} style={{ background: "transparent" }}>
      <Banner />
    </FluentProvider>
  );
}

const label = getCurrentWindow().label;

function content() {
  switch (label) {
    case "overlay":
      return <Overlay />;
    case "flyout":
      return <FlyoutRoot />;
    case "banner":
      return <BannerRoot />;
    default:
      return <Root />;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{content()}</React.StrictMode>,
);
