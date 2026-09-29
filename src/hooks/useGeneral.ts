import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_MONITOR_PREFERENCE,
  loadBtAutoDisconnect,
  loadMonitorPreference,
  loadShowDeviceIcon,
  loadStartMinimized,
  loadTrayClick,
  saveBtAutoDisconnect,
  saveMonitorPreference,
  saveShowDeviceIcon,
  saveStartMinimized,
  saveTrayClick,
  type MonitorPreference,
  type TrayClickConfig,
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
  trayClick: TrayClickConfig;
  setTrayClickAction: (icon: keyof TrayClickConfig, value: TrayClickConfig[keyof TrayClickConfig]) => void;
  monitor: MonitorPreference;
  setMonitor: (value: MonitorPreference) => void;
  bluetoothAutoDisconnect: boolean;
  setBtAutoDisconnect: (value: boolean) => void;
}

/**
 * General settings: "start with Windows" (OS-level via the autostart plugin)
 * and "start minimized" (persisted; read by the backend at launch).
 */
export function useGeneral(): UseGeneral {
  const [autostart, setAutostartState] = useState(false);
  const [startMinimized, setStartMinimizedState] = useState(false);
  const [showDeviceIcon, setShowDeviceIconState] = useState(true);
  const [trayClick, setTrayClickState] = useState<TrayClickConfig>({
    mic: "flyout",
    device: "flyout",
  });
  const [monitor, setMonitorState] = useState<MonitorPreference>(
    DEFAULT_MONITOR_PREFERENCE,
  );
  const [bluetoothAutoDisconnect, setBtAutoDisconnectState] = useState(false);

  useEffect(() => {
    void getAutostart()
      .then(setAutostartState)
      .catch((e) => console.error("could not read the autostart state", e));
    void loadStartMinimized().then(setStartMinimizedState);
    void loadShowDeviceIcon().then(setShowDeviceIconState);
    void loadTrayClick().then(setTrayClickState);
    void loadMonitorPreference().then(setMonitorState);
    void loadBtAutoDisconnect().then(setBtAutoDisconnectState);
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

  // The backend re-reads the file on every tray click, so saving is all it
  // takes to apply live.
  const setTrayClickAction = useCallback(
    (
      icon: keyof TrayClickConfig,
      value: TrayClickConfig[keyof TrayClickConfig],
    ) => {
      setTrayClickState((current) => {
        const next = { ...current, [icon]: value };
        void saveTrayClick(next);
        return next;
      });
    },
    [],
  );

  // Read by the backend the next time an aux window is positioned, so there is
  // no command to call here.
  const setMonitor = useCallback((value: MonitorPreference) => {
    setMonitorState(value);
    void saveMonitorPreference(value);
  }, []);

  // The backend re-reads the file on every default-output change, so saving is
  // all it takes to apply.
  const setBtAutoDisconnect = useCallback((value: boolean) => {
    setBtAutoDisconnectState(value);
    void saveBtAutoDisconnect(value);
  }, []);

  return {
    autostart,
    setAutostart,
    startMinimized,
    setStartMinimized,
    showDeviceIcon,
    setShowDeviceIcon,
    trayClick,
    setTrayClickAction,
    monitor,
    setMonitor,
    bluetoothAutoDisconnect,
    setBtAutoDisconnect,
  };
}
