import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_MONITOR_PREFERENCE,
  loadMonitorPreference,
  loadShowDeviceIcon,
  loadStartMinimized,
  saveMonitorPreference,
  saveShowDeviceIcon,
  saveStartMinimized,
  type MonitorPreference,
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
  monitor: MonitorPreference;
  setMonitor: (value: MonitorPreference) => void;
}

/**
 * General settings: "start with Windows" (OS-level via the autostart plugin)
 * and "start minimized" (persisted; read by the backend at launch).
 */
export function useGeneral(): UseGeneral {
  const [autostart, setAutostartState] = useState(false);
  const [startMinimized, setStartMinimizedState] = useState(false);
  const [showDeviceIcon, setShowDeviceIconState] = useState(true);
  const [monitor, setMonitorState] = useState<MonitorPreference>(
    DEFAULT_MONITOR_PREFERENCE,
  );

  useEffect(() => {
    void getAutostart()
      .then(setAutostartState)
      .catch((e) => console.error("could not read the autostart state", e));
    void loadStartMinimized().then(setStartMinimizedState);
    void loadShowDeviceIcon().then(setShowDeviceIconState);
    void loadMonitorPreference().then(setMonitorState);
  }, []);

  const setAutostart = useCallback((value: boolean) => {
    setAutostartState(value);
    void apiSetAutostart(value).catch((e) => {
      // Registering with Windows can fail (policy, permissions); at least
      // leave a trace instead of a switch that silently does nothing.
      console.error("could not change the autostart registration", e);
    });
  }, []);

  const setStartMinimized = useCallback((value: boolean) => {
    setStartMinimizedState(value);
    void saveStartMinimized(value);
  }, []);

  const setShowDeviceIcon = useCallback((value: boolean) => {
    setShowDeviceIconState(value);
    void saveShowDeviceIcon(value);
    // Apply live so the tray updates without waiting on the store write.
    void apiSetDeviceIcon(value).catch((e) =>
      console.error("could not toggle the device tray icon", e),
    );
  }, []);

  // Read by the backend the next time an aux window is positioned, so there is
  // no command to call here.
  const setMonitor = useCallback((value: MonitorPreference) => {
    setMonitorState(value);
    void saveMonitorPreference(value);
  }, []);

  return {
    autostart,
    setAutostart,
    startMinimized,
    setStartMinimized,
    showDeviceIcon,
    setShowDeviceIcon,
    monitor,
    setMonitor,
  };
}
