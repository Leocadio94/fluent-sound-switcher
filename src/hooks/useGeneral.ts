import { useCallback, useEffect, useState } from "react";

import {
  loadShowDeviceIcon,
  loadStartMinimized,
  saveShowDeviceIcon,
  saveStartMinimized,
} from "../lib/config";
import {
  getAutostart,
  setAutostart as apiSetAutostart,
  setDeviceIcon as apiSetDeviceIcon,
} from "../lib/tauri";

interface UseGeneral {
  autostart: boolean;
  setAutostart: (value: boolean) => void;
  startMinimized: boolean;
  setStartMinimized: (value: boolean) => void;
  showDeviceIcon: boolean;
  setShowDeviceIcon: (value: boolean) => void;
}

/**
 * General settings: "start with Windows" (OS-level via the autostart plugin)
 * and "start minimized" (persisted; read by the backend at launch).
 */
export function useGeneral(): UseGeneral {
  const [autostart, setAutostartState] = useState(false);
  const [startMinimized, setStartMinimizedState] = useState(false);
  const [showDeviceIcon, setShowDeviceIconState] = useState(true);

  useEffect(() => {
    void getAutostart()
      .then(setAutostartState)
      .catch(() => {});
    void loadStartMinimized().then(setStartMinimizedState);
    void loadShowDeviceIcon().then(setShowDeviceIconState);
  }, []);

  const setAutostart = useCallback((value: boolean) => {
    setAutostartState(value);
    void apiSetAutostart(value).catch(() => {});
  }, []);

  const setStartMinimized = useCallback((value: boolean) => {
    setStartMinimizedState(value);
    void saveStartMinimized(value);
  }, []);

  const setShowDeviceIcon = useCallback((value: boolean) => {
    setShowDeviceIconState(value);
    void saveShowDeviceIcon(value);
    // Apply live so the tray updates without waiting on the store write.
    void apiSetDeviceIcon(value).catch(() => {});
  }, []);

  return {
    autostart,
    setAutostart,
    startMinimized,
    setStartMinimized,
    showDeviceIcon,
    setShowDeviceIcon,
  };
}
