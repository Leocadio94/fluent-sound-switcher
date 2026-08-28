import { useCallback, useEffect, useState } from "react";

import {
  listAudioDevices,
  setDefaultAudioDevice,
  type AudioDevice,
} from "../lib/tauri";
import { useTauriEvent } from "./useTauriEvent";

/**
 * What failed, plus the raw backend message.
 *
 * The error used to be stored as `String(e)` and rendered directly, so the user
 * got an untranslated COM error as the headline. The `kind` maps to a
 * translated sentence; `detail` stays available as secondary text for a bug
 * report.
 */
export interface DeviceError {
  kind: "list" | "switch";
  detail: string;
}

interface UseDevices {
  devices: AudioDevice[];
  /** True during the first load and any explicit refresh. */
  loading: boolean;
  error: DeviceError | null;
  refresh: () => Promise<void>;
  switchTo: (device: AudioDevice, notify?: boolean) => Promise<void>;
  /** Id of the device currently being switched to, if any. */
  switching: string | null;
}

/**
 * Loads the device list from the backend and exposes a `switchTo` action that
 * sets a new default and refreshes the list.
 */
export function useDevices(): UseDevices {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DeviceError | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  /**
   * `background` skips the loading flag: a refresh triggered by a backend
   * `device-changed` event should not blank the list the user is looking at.
   */
  const load = useCallback(async (background: boolean) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      setDevices(await listAudioDevices());
    } catch (e) {
      setError({ kind: "list", detail: String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  // Used by the refresh button, which needs the spinner.
  const refresh = useCallback(() => load(false), [load]);

  const switchTo = useCallback(
    async (device: AudioDevice, notify = false) => {
      setSwitching(device.id);
      setError(null);
      try {
        await setDefaultAudioDevice(device.id, notify);
        await load(true);
      } catch (e) {
        setError({ kind: "switch", detail: String(e) });
      } finally {
        setSwitching(null);
      }
    },
    [load],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // A hotkey-, CLI- or sound-panel-driven switch makes the backend emit
  // "device-changed"; refresh quietly so the active badge follows along.
  const onDeviceChanged = useCallback(() => void load(true), [load]);
  useTauriEvent("device-changed", onDeviceChanged, [onDeviceChanged]);

  return { devices, loading, error, refresh, switchTo, switching };
}
