import { useEffect } from "react";

import { autostartAction } from "../lib/autostart";
import { loadAutostartPreference, saveAutostartPreference } from "../lib/config";
import { getAutostart, setAutostart } from "../lib/tauri";

/**
 * Puts "start with Windows" back when a reinstall removed it, and records the
 * state for someone who enabled it before the preference was stored. Lives in
 * the main window's root because the settings tab that owns the switch only
 * mounts when it is open.
 * @see docs/autostart-e-reinstalacao.md
 */
export function useRestoreAutostart(): void {
  useEffect(() => {
    // `tauri dev` shares the config file with the installed app, and enabling
    // it from there would register the debug executable.
    if (import.meta.env.DEV) return;
    void (async () => {
      const action = autostartAction(
        await loadAutostartPreference(),
        await getAutostart(),
      );
      if (action === "enable") await setAutostart(true);
      if (action !== "none") await saveAutostartPreference(true);
    })().catch((e) => console.error("could not restore the autostart entry", e));
  }, []);
}
