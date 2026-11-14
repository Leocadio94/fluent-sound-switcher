import { getCurrentWindow } from "@tauri-apps/api/window";

import type { WindowMaterial } from "../lib/config";
import { setWindowMaterial } from "../lib/tauri";
import type { ThemePreference } from "./useSystemTheme";

/**
 * Pins the window's own theme to the app's preference.
 *
 * The backdrop and the native caption take light/dark from the window, not from
 * the page, so with the app on "light" and Windows on dark the Mica would
 * otherwise come out dark behind a light UI. "system" hands control back.
 */
export function syncWindowTheme(pref: ThemePreference): Promise<void> {
  return getCurrentWindow()
    .setTheme(pref === "system" ? null : pref)
    .catch((e) => console.error("could not sync the window theme", e));
}

/** The first render waits for the backdrop; it must not wait forever. */
const CHROME_TIMEOUT_MS = 2000;

/**
 * Sets the main window's theme and backdrop and returns the material actually
 * in effect. Failure or a timeout answers "solid", which is always safe to
 * paint, so a stuck call can never keep the hidden window from appearing.
 */
export async function applyMainWindowChrome(
  pref: ThemePreference,
  material: WindowMaterial,
): Promise<WindowMaterial> {
  const apply = async () => {
    await syncWindowTheme(pref);
    return setWindowMaterial(material);
  };
  const timeout = new Promise<WindowMaterial>((resolve) =>
    setTimeout(() => resolve("solid"), CHROME_TIMEOUT_MS),
  );
  return Promise.race([apply(), timeout]).catch((e) => {
    console.error("could not apply the window material", e);
    return "solid";
  });
}
