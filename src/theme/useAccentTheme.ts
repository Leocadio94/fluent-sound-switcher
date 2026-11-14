import { useEffect, useState } from "react";
import {
  createDarkTheme,
  createLightTheme,
  webDarkTheme,
  webLightTheme,
  type Theme,
} from "@fluentui/react-components";

import { useTauriEvent } from "../hooks/useTauriEvent";
import { getAccentPalette, type AccentPalette } from "../lib/tauri";
import { paletteToBrand } from "./accentTheme";
import { withWindowsFont } from "./windowsFont";

const DEFAULT_THEMES = {
  light: withWindowsFont(webLightTheme),
  dark: withWindowsFont(webDarkTheme),
};

/**
 * Themes built from the Windows accent colour, or the Fluent defaults when the
 * user turned that off — or when Windows would not tell us the colour.
 *
 * Both themes are built together so switching light/dark never has to wait on
 * a rebuild, and they are cached per palette: `createLightTheme` walks the whole
 * token set, which is not something to redo on every render.
 */
export function useAccentTheme(enabled: boolean): {
  light: Theme;
  dark: Theme;
} {
  const [palette, setPalette] = useState<AccentPalette | null>(null);

  useEffect(() => {
    if (!enabled) return;
    void getAccentPalette()
      .then(setPalette)
      .catch((e) => console.error("could not read the accent colour", e));
  }, [enabled]);

  // The user can change their accent colour while the app is open.
  useTauriEvent<AccentPalette>("accent-changed", (event) =>
    setPalette(event.payload),
  );

  const [themes, setThemes] = useState(DEFAULT_THEMES);

  useEffect(() => {
    const brand = enabled && palette ? paletteToBrand(palette) : null;
    if (enabled && palette && !brand) {
      // A shade we could not parse: better the default palette than a ramp
      // built from half a reading.
      console.warn("accent palette was unreadable; keeping the default theme");
    }
    setThemes(
      brand
        ? {
            light: withWindowsFont(createLightTheme(brand)),
            dark: withWindowsFont(createDarkTheme(brand)),
          }
        : DEFAULT_THEMES,
    );
  }, [enabled, palette]);

  return themes;
}
