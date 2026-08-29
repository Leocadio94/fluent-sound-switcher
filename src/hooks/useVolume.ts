import { useCallback, useEffect, useRef, useState } from "react";

import {
  getDeviceMuted,
  getDeviceVolume,
  setDeviceVolume,
  toggleDeviceMute,
  type AudioDevice,
  type VolumeChanged,
} from "../lib/tauri";
import { useTauriEvent } from "./useTauriEvent";

/** Level (0-1) and mute state per device id. */
export interface DeviceVolume {
  level: number;
  muted: boolean;
}

interface UseVolume {
  volumes: Record<string, DeviceVolume>;
  setLevel: (device: AudioDevice, level: number) => void;
  toggleMute: (device: AudioDevice) => void;
}

/**
 * Dragging a slider fires continuously; sending every intermediate value would
 * mean a COM round-trip per pixel.
 */
const WRITE_DEBOUNCE_MS = 40;

/**
 * Tracks per-device volume and mute for a list of devices.
 *
 * Levels are fetched on demand rather than included in `list_audio_devices`:
 * that would mean activating an `IAudioEndpointVolume` interface for every
 * endpoint on every refresh, and the list is refetched on each
 * `device-changed`.
 */
export function useVolume(devices: AudioDevice[]): UseVolume {
  const [volumes, setVolumes] = useState<Record<string, DeviceVolume>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load (and drop) entries as the device list changes.
  useEffect(() => {
    let cancelled = false;
    for (const device of devices) {
      // An unplugged or disabled endpoint has no volume to read.
      if (device.state !== "active") continue;
      void Promise.all([
        getDeviceVolume(device.direction, device.id),
        getDeviceMuted(device.direction, device.id),
      ])
        .then(([level, muted]) => {
          if (cancelled) return;
          setVolumes((prev) => ({ ...prev, [device.id]: { level, muted } }));
        })
        .catch((e) =>
          // A device can disappear between listing and querying it.
          console.error(`could not read the volume of ${device.name}`, e),
        );
    }
    return () => {
      cancelled = true;
    };
  }, [devices]);

  // The listener is registered once, so reading `devices` from the closure
  // would pin it to the empty array of the first render and the lookup below
  // would never match anything — which is exactly why volume changed from
  // Windows was not showing up here. A ref always sees the current list.
  const latestDevices = useRef(devices);
  latestDevices.current = devices;

  // The backend watches the default output, so a change from the keyboard
  // wheel or the Windows mixer lands here.
  useTauriEvent<VolumeChanged>("volume-changed", (event) => {
    const { level, muted, direction } = event.payload;
    const target = latestDevices.current.find(
      (d) => d.direction === direction && d.isDefault,
    );
    if (!target) return;
    setVolumes((prev) => ({ ...prev, [target.id]: { level, muted } }));
  });

  const setLevel = useCallback((device: AudioDevice, level: number) => {
    // Move the slider immediately, write to the device on a short debounce.
    setVolumes((prev) => ({
      ...prev,
      [device.id]: { level, muted: prev[device.id]?.muted ?? false },
    }));

    clearTimeout(timers.current[device.id]);
    timers.current[device.id] = setTimeout(() => {
      void setDeviceVolume(device.direction, level, device.id).catch((e) =>
        console.error(`could not set the volume of ${device.name}`, e),
      );
    }, WRITE_DEBOUNCE_MS);
  }, []);

  const toggleMute = useCallback((device: AudioDevice) => {
    void toggleDeviceMute(device.direction, device.id)
      .then((muted) =>
        setVolumes((prev) => ({
          ...prev,
          [device.id]: { level: prev[device.id]?.level ?? 0, muted },
        })),
      )
      .catch((e) => console.error(`could not mute ${device.name}`, e));
  }, []);

  // Drop any pending write when the component goes away.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of Object.values(pending)) clearTimeout(timer);
    };
  }, []);

  return { volumes, setLevel, toggleMute };
}
