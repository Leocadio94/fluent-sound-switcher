import { useCallback, useEffect, useState } from "react";

import {
  listBluetoothDevices,
  setBluetoothConnect,
  type BtDevice,
} from "../lib/tauri";
import { useTauriEvent } from "./useTauriEvent";

interface UseBluetooth {
  /** Paired Bluetooth audio devices, with the current connection state. */
  devices: BtDevice[];
  /** MAC of the device with a connect/disconnect request in flight. */
  busyMac: string | null;
  /** Raw backend error from the last call, for the error bar detail. */
  error: string | null;
  refresh: () => Promise<void>;
  setConnect: (mac: string, enable: boolean) => Promise<void>;
}

/**
 * Loads the paired Bluetooth audio devices and exposes the connect/disconnect
 * action. The connection state is owned by Windows, so the list is refreshed
 * on `device-changed` (an endpoint appearing or vanishing) and on window
 * focus, and after every toggle.
 */
export function useBluetooth(): UseBluetooth {
  const [devices, setDevices] = useState<BtDevice[]>([]);
  const [busyMac, setBusyMac] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDevices(await listBluetoothDevices());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const setConnect = useCallback(
    async (mac: string, enable: boolean) => {
      setBusyMac(mac);
      setError(null);
      try {
        await setBluetoothConnect(mac, enable);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusyMac(null);
        await load();
      }
    },
    [load],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onDeviceChanged = useCallback(() => void load(), [load]);
  useTauriEvent("device-changed", onDeviceChanged, [onDeviceChanged]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  return { devices, busyMac, error, refresh: load, setConnect };
}
