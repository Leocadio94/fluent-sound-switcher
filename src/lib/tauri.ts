import { invoke } from "@tauri-apps/api/core";

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
