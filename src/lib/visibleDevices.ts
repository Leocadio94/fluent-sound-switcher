import type { AudioDevice, DeviceDirection } from "./tauri";

interface VisibleOptions {
  onlyFavorites: boolean;
  hideUnavailable: boolean;
}

/**
 * Devices the main list shows. A disconnected favorite stays by default, so a
 * sleeping headset keeps its place; `hideUnavailable` drops it too.
 */
export function visibleDevices(
  devices: AudioDevice[],
  isFavorite: (direction: DeviceDirection, id: string) => boolean,
  { onlyFavorites, hideUnavailable }: VisibleOptions,
): AudioDevice[] {
  return devices.filter((device) => {
    const favorite = isFavorite(device.direction, device.id);
    if (onlyFavorites && !favorite) return false;
    if (device.state === "active") return true;
    return favorite && !hideUnavailable;
  });
}
