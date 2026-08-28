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

/** Whether the app is registered to start with Windows. */
export function getAutostart(): Promise<boolean> {
  return invoke<boolean>("get_autostart");
}

/** Enables/disables starting the app with Windows. */
export function setAutostart(enabled: boolean): Promise<void> {
  return invoke<void>("set_autostart", { enabled });
}

/** A device's volume as a 0-1 scalar. Omit `deviceId` for the current default. */
export function getDeviceVolume(
  direction: DeviceDirection,
  deviceId?: string,
): Promise<number> {
  return invoke<number>("get_device_volume", { deviceId, direction });
}

/** Sets a device's volume from a 0-1 scalar. */
export function setDeviceVolume(
  direction: DeviceDirection,
  level: number,
  deviceId?: string,
): Promise<void> {
  return invoke<void>("set_device_volume", { deviceId, direction, level });
}

/** Toggles a device's mute; resolves to the new state. */
export function toggleDeviceMute(
  direction: DeviceDirection,
  deviceId?: string,
): Promise<boolean> {
  return invoke<boolean>("toggle_device_mute", { deviceId, direction });
}

/** Reads a device's mute state. */
export function getDeviceMuted(
  direction: DeviceDirection,
  deviceId?: string,
): Promise<boolean> {
  return invoke<boolean>("get_device_muted", { deviceId, direction });
}

/** Toggles the default output's mute; resolves to the new state. */
export function toggleOutputMute(): Promise<boolean> {
  return invoke<boolean>("toggle_output_mute");
}

/** Reads whether the default output is muted. */
export function getOutputMuted(): Promise<boolean> {
  return invoke<boolean>("get_output_muted");
}

/** Payload of the `volume-changed` event. */
export interface VolumeChanged {
  level: number;
  muted: boolean;
  direction: DeviceDirection;
}

/** Toggles the default mic mute; resolves to the new muted state. */
export function toggleMicMute(): Promise<boolean> {
  return invoke<boolean>("toggle_mic_mute");
}

/** Reads whether the default microphone is muted. */
export function getMicMuted(): Promise<boolean> {
  return invoke<boolean>("get_mic_muted");
}

/**
 * A binding the OS refused to register — nearly always because another app
 * already owns the combination. Without this the UI would show a dead shortcut
 * as if it worked.
 */
export interface HotkeyFailure {
  /** The `hotkeys` config key, e.g. `cycleOutput`. */
  action: keyof Hotkeys;
  accelerator: string;
  reason: string;
}

/**
 * Re-registers the global shortcuts from the given bindings, resolving to the
 * bindings that could *not* be registered (empty when all took).
 */
export function updateHotkeys(bindings: Hotkeys): Promise<HotkeyFailure[]> {
  return invoke<HotkeyFailure[]>("update_hotkeys", { bindings });
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

/** Shows/hides the output-device tray icon immediately. */
export function setDeviceIcon(enabled: boolean): Promise<void> {
  return invoke<void>("set_device_icon", { enabled });
}

/**
 * Tells the backend the main window has painted, so it can be revealed. The
 * window is created hidden so a login auto-start never flashes on screen.
 */
export function mainWindowReady(): Promise<void> {
  return invoke<void>("main_window_ready");
}

/** Downloads and installs the pending update, then restarts the app. */
export function installUpdate(): Promise<void> {
  return invoke<void>("install_update");
}

/**
 * Switches the language of the strings the backend owns (tray menu,
 * notification titles, updater messages) and rebuilds the tray.
 */
export function setLanguage(language: string): Promise<void> {
  return invoke<void>("set_language", { language });
}

/**
 * Opens the folder with the rotating log file in Explorer. Nothing the backend
 * prints reaches a console in the packaged app, so this is how a user gets the
 * log for a bug report.
 */
export function openLogFolder(): Promise<void> {
  return invoke<void>("open_log_folder");
}
