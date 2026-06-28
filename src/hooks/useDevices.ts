import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import {
  listAudioDevices,
  setDefaultAudioDevice,
  type AudioDevice,
} from "../lib/tauri";

interface UseDevices {
  devices: AudioDevice[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  switchTo: (device: AudioDevice) => Promise<void>;
  switching: string | null;
}

/**
 * Loads the device list from the backend and exposes a `switchTo` action that
 * sets a new default and optimistically refreshes the list.
 */
export function useDevices(): UseDevices {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setDevices(await listAudioDevices());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const switchTo = useCallback(
    async (device: AudioDevice) => {
      setSwitching(device.id);
      setError(null);
      try {
        await setDefaultAudioDevice(device.id);
        await refresh();
      } catch (e) {
        setError(String(e));
      } finally {
        setSwitching(null);
      }
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A hotkey-driven switch on the backend emits "device-changed"; refresh so
  // the active badge follows along.
  useEffect(() => {
    const unlisten = listen("device-changed", () => void refresh());
    return () => {
      void unlisten.then((off) => off());
    };
  }, [refresh]);

  return { devices, loading, error, refresh, switchTo, switching };
}
