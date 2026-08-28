import { load, type Store } from "@tauri-apps/plugin-store";

import type { DeviceDirection } from "./tauri";

/** Device ids the user picked to take part in the cycle list, per direction. */
export interface Favorites {
  output: string[];
  input: string[];
}

export const EMPTY_FAVORITES: Favorites = { output: [], input: [] };

/** Global-shortcut accelerators (Tauri format), one per action. */
export interface Hotkeys {
  cycleOutput: string;
  cycleInput: string;
  toggleMute: string;
}

export const DEFAULT_HOTKEYS: Hotkeys = {
  cycleOutput: "Ctrl+Alt+F11",
  cycleInput: "Ctrl+Alt+F12",
  toggleMute: "Ctrl+Alt+M",
};

export type MuteIndicatorMode =
  | "always"
  | "mutedOnly"
  | "unmutedOnly"
  | "hidden";

export type OverlayPosition =
  | "topCenter"
  | "bottomCenter"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

export type OverlayStyle = "full" | "icon";

/** On-screen mute overlay preferences. */
export interface MuteIndicator {
  mode: MuteIndicatorMode;
  position: OverlayPosition;
  style: OverlayStyle;
}

export const DEFAULT_MUTE_INDICATOR: MuteIndicator = {
  mode: "mutedOnly",
  position: "bottomCenter",
  style: "full",
};

/** Device-change notification preferences. */
export interface NotificationConfig {
  native: boolean;
  banner: boolean;
  sound: boolean;
  bannerPosition: OverlayPosition;
}

export const DEFAULT_NOTIFICATIONS: NotificationConfig = {
  native: false,
  banner: true,
  sound: false,
  bannerPosition: "topCenter",
};

/**
 * Which monitor the overlay, banner and flyout appear on. `cursor` (the
 * default) follows the mouse, which is the cheapest proxy for the screen the
 * user is looking at — the whole point of these windows is being visible over
 * the fullscreen game in front of them.
 */
export type MonitorPreference = "cursor" | "primary" | "foreground";

export const DEFAULT_MONITOR_PREFERENCE: MonitorPreference = "cursor";

/** When a newly-connected output may grab the default: only curated favorites, or any device. */
export type AutoSwitchMode = "favoritesOnly" | "any";

/** Auto-switch-on-connect preferences (e.g. plug a TV/monitor → switch to it). */
export interface AutoSwitchConfig {
  enabled: boolean;
  mode: AutoSwitchMode;
}

export const DEFAULT_AUTO_SWITCH: AutoSwitchConfig = {
  enabled: false,
  mode: "favoritesOnly",
};

const STORE_FILE = "config.json";
const FAVORITES_KEY = "favorites";
const ONLY_FAVORITES_KEY = "showOnlyFavorites";
const HOTKEYS_KEY = "hotkeys";
const MUTE_INDICATOR_KEY = "muteIndicator";
const NOTIFICATIONS_KEY = "notifications";
const AUTO_SWITCH_KEY = "autoSwitch";
const START_MINIMIZED_KEY = "startMinimized";
const SHOW_DEVICE_ICON_KEY = "showDeviceIcon";
const OVERLAY_MONITOR_KEY = "overlayMonitor";
const LANGUAGE_KEY = "language";
const THEME_KEY = "theme";

let storePromise: Promise<Store> | null = null;

/** Lazily opens the AppData-backed config store (auto-saves on every set). */
function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, {
      autoSave: true,
      defaults: {
        [FAVORITES_KEY]: EMPTY_FAVORITES,
        [ONLY_FAVORITES_KEY]: false,
        [HOTKEYS_KEY]: DEFAULT_HOTKEYS,
        [MUTE_INDICATOR_KEY]: DEFAULT_MUTE_INDICATOR,
        [NOTIFICATIONS_KEY]: DEFAULT_NOTIFICATIONS,
        [AUTO_SWITCH_KEY]: DEFAULT_AUTO_SWITCH,
      },
    });
  }
  return storePromise;
}

export async function loadFavorites(): Promise<Favorites> {
  const store = await getStore();
  const stored = await store.get<Favorites>(FAVORITES_KEY);
  return {
    output: stored?.output ?? [],
    input: stored?.input ?? [],
  };
}

export async function saveFavorites(favorites: Favorites): Promise<void> {
  const store = await getStore();
  await store.set(FAVORITES_KEY, favorites);
}

export async function loadShowOnlyFavorites(): Promise<boolean> {
  const store = await getStore();
  return (await store.get<boolean>(ONLY_FAVORITES_KEY)) ?? false;
}

export async function saveShowOnlyFavorites(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(ONLY_FAVORITES_KEY, value);
}

export async function loadHotkeys(): Promise<Hotkeys> {
  const store = await getStore();
  const stored = await store.get<Partial<Hotkeys>>(HOTKEYS_KEY);
  return { ...DEFAULT_HOTKEYS, ...stored };
}

export async function saveHotkeys(hotkeys: Hotkeys): Promise<void> {
  const store = await getStore();
  await store.set(HOTKEYS_KEY, hotkeys);
}

export async function loadMuteIndicator(): Promise<MuteIndicator> {
  const store = await getStore();
  const stored = await store.get<Partial<MuteIndicator>>(MUTE_INDICATOR_KEY);
  return { ...DEFAULT_MUTE_INDICATOR, ...stored };
}

export async function saveMuteIndicator(value: MuteIndicator): Promise<void> {
  const store = await getStore();
  await store.set(MUTE_INDICATOR_KEY, value);
}

export async function loadNotifications(): Promise<NotificationConfig> {
  const store = await getStore();
  const stored = await store.get<Partial<NotificationConfig>>(NOTIFICATIONS_KEY);
  return { ...DEFAULT_NOTIFICATIONS, ...stored };
}

export async function saveNotifications(value: NotificationConfig): Promise<void> {
  const store = await getStore();
  await store.set(NOTIFICATIONS_KEY, value);
}

export async function loadAutoSwitch(): Promise<AutoSwitchConfig> {
  const store = await getStore();
  const stored = await store.get<Partial<AutoSwitchConfig>>(AUTO_SWITCH_KEY);
  return { ...DEFAULT_AUTO_SWITCH, ...stored };
}

export async function saveAutoSwitch(value: AutoSwitchConfig): Promise<void> {
  const store = await getStore();
  await store.set(AUTO_SWITCH_KEY, value);
}

export async function loadStartMinimized(): Promise<boolean> {
  const store = await getStore();
  return (await store.get<boolean>(START_MINIMIZED_KEY)) ?? false;
}

export async function saveStartMinimized(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(START_MINIMIZED_KEY, value);
}

export async function loadShowDeviceIcon(): Promise<boolean> {
  const store = await getStore();
  return (await store.get<boolean>(SHOW_DEVICE_ICON_KEY)) ?? true;
}

export async function saveShowDeviceIcon(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(SHOW_DEVICE_ICON_KEY, value);
}

export async function loadMonitorPreference(): Promise<MonitorPreference> {
  const store = await getStore();
  return (
    (await store.get<MonitorPreference>(OVERLAY_MONITOR_KEY)) ??
    DEFAULT_MONITOR_PREFERENCE
  );
}

export async function saveMonitorPreference(
  value: MonitorPreference,
): Promise<void> {
  const store = await getStore();
  await store.set(OVERLAY_MONITOR_KEY, value);
}

/**
 * The UI language. Read by the backend too, for the strings it owns (tray menu,
 * notification titles, updater messages).
 */
export async function loadLanguage(): Promise<string | null> {
  const store = await getStore();
  return (await store.get<string>(LANGUAGE_KEY)) ?? null;
}

export async function saveLanguage(value: string): Promise<void> {
  const store = await getStore();
  await store.set(LANGUAGE_KEY, value);
}

/** Theme preference: "system" | "light" | "dark". */
export async function loadTheme(): Promise<string | null> {
  const store = await getStore();
  return (await store.get<string>(THEME_KEY)) ?? null;
}

export async function saveTheme(value: string): Promise<void> {
  const store = await getStore();
  await store.set(THEME_KEY, value);
}

export type { DeviceDirection };
