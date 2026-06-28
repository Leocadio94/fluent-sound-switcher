import { useCallback, useEffect, useState } from "react";

import { DEFAULT_HOTKEYS, loadHotkeys, saveHotkeys, type Hotkeys } from "../lib/config";
import { updateHotkeys } from "../lib/tauri";

interface UseHotkeys {
  hotkeys: Hotkeys;
  setBinding: (action: keyof Hotkeys, accelerator: string) => void;
}

/**
 * Loads the persisted hotkey bindings and, on every edit, persists them and
 * asks the backend to re-register the global shortcuts.
 */
export function useHotkeys(): UseHotkeys {
  const [hotkeys, setHotkeys] = useState<Hotkeys>(DEFAULT_HOTKEYS);

  useEffect(() => {
    void loadHotkeys().then(setHotkeys);
  }, []);

  const setBinding = useCallback(
    (action: keyof Hotkeys, accelerator: string) => {
      setHotkeys((prev) => {
        const next = { ...prev, [action]: accelerator };
        void saveHotkeys(next).then(() => updateHotkeys(next));
        return next;
      });
    },
    [],
  );

  return { hotkeys, setBinding };
}
