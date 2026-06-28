import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { getCurrentWindow } from "@tauri-apps/api/window";

import App from "./App";
import Overlay from "./views/Overlay";
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

const isOverlay = getCurrentWindow().label === "overlay";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isOverlay ? <Overlay /> : <Root />}</React.StrictMode>,
);
