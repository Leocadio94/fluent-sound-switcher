import { invoke } from "@tauri-apps/api/core";

import type { Hotkeys, MuteIndicator } from "./config";

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

/**
 * Switches the system default device (all roles) to the given endpoint id.
 * `notify` fires a device-change notification (used by hotkey/flyout switches,
 * not manual clicks in the main window).
 */
export function setDefaultAudioDevice(
  deviceId: string,
  notify = false,
): Promise<void> {
  return invoke<void>("set_default_audio_device", { deviceId, notify });
}

/** Triggers a sample notification so the user can preview their settings. */
export function previewNotification(): Promise<void> {
  return invoke<void>("preview_notification");
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

/** Re-applies the overlay with the given settings after a change. */
export function refreshMuteIndicator(indicator: MuteIndicator): Promise<void> {
  return invoke<void>("refresh_mute_indicator", { indicator });
}

/** Resizes the quick-switch flyout to fit its content (logical px height). */
export function setFlyoutSize(height: number): Promise<void> {
  return invoke<void>("set_flyout_size", { height });
}

/** Hides the quick-switch flyout. */
export function closeFlyout(): Promise<void> {
  return invoke<void>("close_flyout");
}
