import { invoke } from "@tauri-apps/api/core";

import type { Hotkeys } from "./config";

export type DeviceDirection = "output" | "input";

export interface AudioDevice {
  id: string;
  name: string;
  direction: DeviceDirection;
  isDefault: boolean;
}

/** Lists active input/output devices with the current defaults flagged. */
export function listAudioDevices(): Promise<AudioDevice[]> {
  return invoke<AudioDevice[]>("list_audio_devices");
}

/** Switches the system default device (all roles) to the given endpoint id. */
export function setDefaultAudioDevice(deviceId: string): Promise<void> {
  return invoke<void>("set_default_audio_device", { deviceId });
}

/** Toggles the default mic mute; resolves to the new muted state. */
export function toggleMicMute(): Promise<boolean> {
  return invoke<boolean>("toggle_mic_mute");
}

/** Reads whether the default microphone is muted. */
export function getMicMuted(): Promise<boolean> {
  return invoke<boolean>("get_mic_muted");
}

/** Re-registers the global shortcuts from the given bindings. */
export function updateHotkeys(bindings: Hotkeys): Promise<void> {
  return invoke<void>("update_hotkeys", { bindings });
}

/** Re-applies overlay visibility/position after a settings change. */
export function refreshMuteIndicator(): Promise<void> {
  return invoke<void>("refresh_mute_indicator");
}

/** Resizes the quick-switch flyout to fit its content (logical px height). */
export function setFlyoutSize(height: number): Promise<void> {
  return invoke<void>("set_flyout_size", { height });
}

/** Hides the quick-switch flyout. */
export function closeFlyout(): Promise<void> {
  return invoke<void>("close_flyout");
}
