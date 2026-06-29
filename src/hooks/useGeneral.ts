import { useCallback, useEffect, useState } from "react";

import { loadStartMinimized, saveStartMinimized } from "../lib/config";
import { getAutostart, setAutostart as apiSetAutostart } from "../lib/tauri";

interface UseGeneral {
  autostart: boolean;
  setAutostart: (value: boolean) => void;
  startMinimized: boolean;
  setStartMinimized: (value: boolean) => void;
}

/**
 * General settings: "start with Windows" (OS-level via the autostart plugin)
 * and "start minimized" (persisted; read by the backend at launch).
 */
export function useGeneral(): UseGeneral {
  const [autostart, setAutostartState] = useState(false);
  const [startMinimized, setStartMinimizedState] = useState(false);

  useEffect(() => {
    void getAutostart()
      .then(setAutostartState)
      .catch(() => {});
    void loadStartMinimized().then(setStartMinimizedState);
  }, []);

  const setAutostart = useCallback((value: boolean) => {
    setAutostartState(value);
    void apiSetAutostart(value).catch(() => {});
  }, []);

  const setStartMinimized = useCallback((value: boolean) => {
    setStartMinimizedState(value);
    void saveStartMinimized(value);
  }, []);

  return { autostart, setAutostart, startMinimized, setStartMinimized };
}
