import { useCallback, useEffect, useState } from "react";

import { DEFAULT_HOTKEYS, loadHotkeys, type Hotkeys } from "../lib/config";
import { useTauriEvent } from "./useTauriEvent";

/**
 * The configured global shortcuts, read-only, for showing as hints beside the
 * actions they trigger. The flyout window lives suspended and never sees a
 * binding changed in the main window, so it reloads on every open.
 */
export function useHotkeyHints(): Hotkeys {
  const [hotkeys, setHotkeys] = useState<Hotkeys>(DEFAULT_HOTKEYS);
  const reload = useCallback(() => {
    void loadHotkeys()
      .then(setHotkeys)
      .catch((e) => console.error("could not read the hotkeys", e));
  }, []);

  useEffect(reload, [reload]);
  useTauriEvent("flyout-opened", reload, [reload]);
  return hotkeys;
}
