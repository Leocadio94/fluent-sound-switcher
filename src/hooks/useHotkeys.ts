import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_HOTKEYS, loadHotkeys, saveHotkeys, type Hotkeys } from "../lib/config";
import { updateHotkeys, type HotkeyFailure } from "../lib/tauri";

interface UseHotkeys {
  hotkeys: Hotkeys;
  setBinding: (action: keyof Hotkeys, accelerator: string) => void;
  /** Bindings the OS refused, so the UI can warn instead of lying. */
  failures: HotkeyFailure[];
}

/**
 * Loads the persisted hotkey bindings and, on every edit, persists them and
 * asks the backend to re-register the global shortcuts.
 *
 * Registration can fail (another app owns the combination); the backend reports
 * which bindings did not take and we surface them.
 */
export function useHotkeys(): UseHotkeys {
  const [hotkeys, setHotkeys] = useState<Hotkeys>(DEFAULT_HOTKEYS);
  const [failures, setFailures] = useState<HotkeyFailure[]>([]);
  const latest = useRef(hotkeys);

  useEffect(() => {
    void loadHotkeys().then((loaded) => {
      latest.current = loaded;
      setHotkeys(loaded);
    });
  }, []);

  const setBinding = useCallback(
    (action: keyof Hotkeys, accelerator: string) => {
      const next = { ...latest.current, [action]: accelerator };
      latest.current = next;
      setHotkeys(next);
      // Outside the state updater: updaters must be pure, and React 19 runs
      // them twice under StrictMode — which re-registered the shortcuts twice.
      void saveHotkeys(next)
        .then(() => updateHotkeys(next))
        .then(setFailures)
        .catch((e) => {
          console.error("could not update hotkeys", e);
          setFailures([]);
        });
    },
    [],
  );

  return { hotkeys, setBinding, failures };
}
