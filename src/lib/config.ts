import { load, type Store } from "@tauri-apps/plugin-store";

import type { DeviceDirection } from "./tauri";
import {
  boolOr,
  migrate,
  oneOf,
  stringList,
  stringOr,
} from "./configSchema";

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
  volumeUp: string;
  volumeDown: string;
  toggleOutputMute: string;
}

export const DEFAULT_HOTKEYS: Hotkeys = {
  cycleOutput: "Ctrl+Alt+F11",
  cycleInput: "Ctrl+Alt+F12",
  toggleMute: "Ctrl+Alt+M",
  // The volume bindings default to empty on purpose: registering the media keys
  // globally would take them away from Windows, so they are strictly opt-in.
  volumeUp: "",
  volumeDown: "",
  toggleOutputMute: "",
};

export const MUTE_INDICATOR_MODES = [
  "always",
  "mutedOnly",
  "unmutedOnly",
  "hidden",
] as const;
export type MuteIndicatorMode = (typeof MUTE_INDICATOR_MODES)[number];

export const OVERLAY_POSITIONS = [
  "topCenter",
  "bottomCenter",
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
] as const;
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];

export const OVERLAY_STYLES = ["full", "icon"] as const;
export type OverlayStyle = (typeof OVERLAY_STYLES)[number];

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

/** Volume on-screen-display preferences; shares the overlay window. */
export interface VolumeOsd {
  /** Show the on-screen level when a volume hotkey fires. */
  enabled: boolean;
  position: OverlayPosition;
  /** Show a volume slider on each row of the main device list. */
  sliders: boolean;
  /** Show it in the tray flyout too, where space is tighter. */
  slidersInFlyout: boolean;
}

export const DEFAULT_VOLUME_OSD: VolumeOsd = {
  enabled: true,
  position: "bottomCenter",
  sliders: true,
  slidersInFlyout: false,
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
export const MONITOR_PREFERENCES = ["cursor", "primary", "foreground"] as const;
export type MonitorPreference = (typeof MONITOR_PREFERENCES)[number];

export const DEFAULT_MONITOR_PREFERENCE: MonitorPreference = "cursor";

/** When a newly-connected output may grab the default: only curated favorites, or any device. */
export const AUTO_SWITCH_MODES = ["favoritesOnly", "any"] as const;
export type AutoSwitchMode = (typeof AUTO_SWITCH_MODES)[number];

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
const VOLUME_OSD_KEY = "volumeOsd";
const LANGUAGE_KEY = "language";
const THEME_KEY = "theme";
const SYSTEM_ACCENT_KEY = "useSystemAccent";

const SCHEMA_VERSION_KEY = "schemaVersion";

let storePromise: Promise<Store> | null = null;

/**
 * Lazily opens the AppData-backed config store (auto-saves on every set) and
 * brings the document up to the current schema on first open.
 *
 * `schemaVersion` is deliberately *not* in `defaults`: the plugin serves
 * defaults for absent keys, so listing it would make an old file read back as
 * already-current and skip the very migration it needs. It is read on its own
 * and written explicitly.
 *
 * The other defaults only cover reads in this process — the plugin does not
 * write them to disk until something calls `set`. The backend keeps its own
 * fallbacks for the keys it reads straight from the file.
 */
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
        [START_MINIMIZED_KEY]: false,
        [SHOW_DEVICE_ICON_KEY]: true,
        [OVERLAY_MONITOR_KEY]: DEFAULT_MONITOR_PREFERENCE,
        [SYSTEM_ACCENT_KEY]: true,
        [VOLUME_OSD_KEY]: DEFAULT_VOLUME_OSD,
      },
    }).then(async (store) => {
      const version = await store.get(SCHEMA_VERSION_KEY);
      const stored = Object.fromEntries(await store.entries());
      const migrated = migrate({ ...stored, [SCHEMA_VERSION_KEY]: version });
      for (const [key, value] of Object.entries(migrated)) {
        if (stored[key] !== value) await store.set(key, value);
      }
      return store;
    });
  }
  return storePromise;
}

export async function loadFavorites(): Promise<Favorites> {
  const store = await getStore();
  const stored = await store.get<Partial<Favorites>>(FAVORITES_KEY);
  return {
    output: stringList(stored?.output),
    input: stringList(stored?.input),
  };
}

export async function saveFavorites(favorites: Favorites): Promise<void> {
  const store = await getStore();
  await store.set(FAVORITES_KEY, favorites);
}

export async function loadShowOnlyFavorites(): Promise<boolean> {
  const store = await getStore();
  return boolOr(await store.get(ONLY_FAVORITES_KEY), false);
}

export async function saveShowOnlyFavorites(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(ONLY_FAVORITES_KEY, value);
}

export async function loadHotkeys(): Promise<Hotkeys> {
  const store = await getStore();
  const stored = await store.get<Partial<Hotkeys>>(HOTKEYS_KEY);
  return {
    cycleOutput: stringOr(stored?.cycleOutput, DEFAULT_HOTKEYS.cycleOutput),
    cycleInput: stringOr(stored?.cycleInput, DEFAULT_HOTKEYS.cycleInput),
    toggleMute: stringOr(stored?.toggleMute, DEFAULT_HOTKEYS.toggleMute),
    volumeUp: stringOr(stored?.volumeUp, DEFAULT_HOTKEYS.volumeUp),
    volumeDown: stringOr(stored?.volumeDown, DEFAULT_HOTKEYS.volumeDown),
    toggleOutputMute: stringOr(
      stored?.toggleOutputMute,
      DEFAULT_HOTKEYS.toggleOutputMute,
    ),
  };
}

export async function saveHotkeys(hotkeys: Hotkeys): Promise<void> {
  const store = await getStore();
  await store.set(HOTKEYS_KEY, hotkeys);
}

export async function loadMuteIndicator(): Promise<MuteIndicator> {
  const store = await getStore();
  const stored = await store.get<Partial<MuteIndicator>>(MUTE_INDICATOR_KEY);
  return {
    mode: oneOf(stored?.mode, MUTE_INDICATOR_MODES, DEFAULT_MUTE_INDICATOR.mode),
    position: oneOf(
      stored?.position,
      OVERLAY_POSITIONS,
      DEFAULT_MUTE_INDICATOR.position,
    ),
    style: oneOf(stored?.style, OVERLAY_STYLES, DEFAULT_MUTE_INDICATOR.style),
  };
}

export async function saveMuteIndicator(value: MuteIndicator): Promise<void> {
  const store = await getStore();
  await store.set(MUTE_INDICATOR_KEY, value);
}

export async function loadNotifications(): Promise<NotificationConfig> {
  const store = await getStore();
  const stored = await store.get<Partial<NotificationConfig>>(NOTIFICATIONS_KEY);
  return {
    native: boolOr(stored?.native, DEFAULT_NOTIFICATIONS.native),
    banner: boolOr(stored?.banner, DEFAULT_NOTIFICATIONS.banner),
    sound: boolOr(stored?.sound, DEFAULT_NOTIFICATIONS.sound),
    bannerPosition: oneOf(
      stored?.bannerPosition,
      OVERLAY_POSITIONS,
      DEFAULT_NOTIFICATIONS.bannerPosition,
    ),
  };
}

export async function saveNotifications(value: NotificationConfig): Promise<void> {
  const store = await getStore();
  await store.set(NOTIFICATIONS_KEY, value);
}

export async function loadAutoSwitch(): Promise<AutoSwitchConfig> {
  const store = await getStore();
  const stored = await store.get<Partial<AutoSwitchConfig>>(AUTO_SWITCH_KEY);
  return {
    enabled: boolOr(stored?.enabled, DEFAULT_AUTO_SWITCH.enabled),
    mode: oneOf(stored?.mode, AUTO_SWITCH_MODES, DEFAULT_AUTO_SWITCH.mode),
  };
}

export async function saveAutoSwitch(value: AutoSwitchConfig): Promise<void> {
  const store = await getStore();
  await store.set(AUTO_SWITCH_KEY, value);
}

export async function loadStartMinimized(): Promise<boolean> {
  const store = await getStore();
  return boolOr(await store.get(START_MINIMIZED_KEY), false);
}

export async function saveStartMinimized(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(START_MINIMIZED_KEY, value);
}

export async function loadShowDeviceIcon(): Promise<boolean> {
  const store = await getStore();
  return boolOr(await store.get(SHOW_DEVICE_ICON_KEY), true);
}

export async function saveShowDeviceIcon(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(SHOW_DEVICE_ICON_KEY, value);
}

export async function loadVolumeOsd(): Promise<VolumeOsd> {
  const store = await getStore();
  const stored = await store.get<Partial<VolumeOsd>>(VOLUME_OSD_KEY);
  return {
    enabled: boolOr(stored?.enabled, DEFAULT_VOLUME_OSD.enabled),
    position: oneOf(
      stored?.position,
      OVERLAY_POSITIONS,
      DEFAULT_VOLUME_OSD.position,
    ),
    sliders: boolOr(stored?.sliders, DEFAULT_VOLUME_OSD.sliders),
    slidersInFlyout: boolOr(
      stored?.slidersInFlyout,
      DEFAULT_VOLUME_OSD.slidersInFlyout,
    ),
  };
}

export async function saveVolumeOsd(value: VolumeOsd): Promise<void> {
  const store = await getStore();
  await store.set(VOLUME_OSD_KEY, value);
}

export async function loadMonitorPreference(): Promise<MonitorPreference> {
  const store = await getStore();
  return oneOf(
    await store.get(OVERLAY_MONITOR_KEY),
    MONITOR_PREFERENCES,
    DEFAULT_MONITOR_PREFERENCE,
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

/**
 * Whether to build the palette from the Windows accent colour. On by default:
 * matching the desktop is the point of a Fluent app.
 */
export async function loadUseSystemAccent(): Promise<boolean> {
  const store = await getStore();
  return boolOr(await store.get(SYSTEM_ACCENT_KEY), true);
}

export async function saveUseSystemAccent(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(SYSTEM_ACCENT_KEY, value);
}

export type { DeviceDirection };
