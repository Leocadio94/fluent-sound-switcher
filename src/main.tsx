import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";

import App from "./App";
import { useSystemTheme, type ThemePreference } from "./theme/useSystemTheme";
import "./i18n";
import "./styles.css";

function Root() {
  const [themePref, setThemePref] = useState<ThemePreference>("system");
  const theme = useSystemTheme(themePref);

  return (
    <FluentProvider theme={theme} style={{ height: "100vh" }}>
      <App themePref={themePref} onThemePrefChange={setThemePref} />
    </FluentProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
