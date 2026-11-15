import { load, type Store } from "@tauri-apps/plugin-store";

import type { DeviceDirection } from "./tauri";
import {
  boolOr,
  migrate,
  oneOf,
  stringList,
  stringOr,
  stringRecord,
} from "./configSchema";

/** Device ids the user picked to take part in the cycle list, per direction. */
export interface Favorites {
  output: string[];
  input: string[];
  /**
   * Friendly name of each favorite, by id. Windows gives the same hardware a
   * new endpoint id after a driver update or a USB port change, so the name is
   * what lets a favorite follow its device.
   * @see docs/favoritos-e-ids-de-endpoint.md
   */
  names: Record<string, string>;
}

export const EMPTY_FAVORITES: Favorites = { output: [], input: [], names: {} };

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

/**
 * Gamepad (XInput) shortcut preferences. The chord (LB + RB) and the button
 * mapping are fixed in the backend, so enabled is the only knob.
 */
export interface GamepadHotkeys {
  enabled: boolean;
}

export const DEFAULT_GAMEPAD_HOTKEYS: GamepadHotkeys = { enabled: false };

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
const GAMEPAD_HOTKEYS_KEY = "gamepadHotkeys";
const MUTE_INDICATOR_KEY = "muteIndicator";
const NOTIFICATIONS_KEY = "notifications";
const AUTO_SWITCH_KEY = "autoSwitch";
const AUTOSTART_KEY = "autostart";
const START_MINIMIZED_KEY = "startMinimized";
const SHOW_DEVICE_ICON_KEY = "showDeviceIcon";
const OVERLAY_MONITOR_KEY = "overlayMonitor";
const VOLUME_OSD_KEY = "volumeOsd";
const LANGUAGE_KEY = "language";
const THEME_KEY = "theme";
const SYSTEM_ACCENT_KEY = "useSystemAccent";
const TITLE_BAR_KEY = "titleBarStyle";
const WINDOW_MATERIAL_KEY = "windowMaterial";
const FLOATING_ACRYLIC_KEY = "floatingAcrylic";
const BT_AUTO_DISCONNECT_KEY = "bluetoothAutoDisconnect";
const MIC_MUTE_ALL_KEY = "micMuteAllDevices";
const MIC_MUTE_CALL_SHORTCUT_KEY = "micMuteCallShortcut";

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
        [GAMEPAD_HOTKEYS_KEY]: DEFAULT_GAMEPAD_HOTKEYS,
        [MUTE_INDICATOR_KEY]: DEFAULT_MUTE_INDICATOR,
        [NOTIFICATIONS_KEY]: DEFAULT_NOTIFICATIONS,
        [AUTO_SWITCH_KEY]: DEFAULT_AUTO_SWITCH,
        [START_MINIMIZED_KEY]: false,
        [SHOW_DEVICE_ICON_KEY]: true,
        [OVERLAY_MONITOR_KEY]: DEFAULT_MONITOR_PREFERENCE,
        [SYSTEM_ACCENT_KEY]: true,
        [TITLE_BAR_KEY]: "custom",
        [WINDOW_MATERIAL_KEY]: DEFAULT_WINDOW_MATERIAL,
        [FLOATING_ACRYLIC_KEY]: true,
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
    names: stringRecord(stored?.names),
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

export async function loadGamepadHotkeys(): Promise<GamepadHotkeys> {
  const store = await getStore();
  const stored = await store.get<Partial<GamepadHotkeys>>(GAMEPAD_HOTKEYS_KEY);
  return {
    enabled: boolOr(stored?.enabled, DEFAULT_GAMEPAD_HOTKEYS.enabled),
  };
}

export async function saveGamepadHotkeys(value: GamepadHotkeys): Promise<void> {
  const store = await getStore();
  await store.set(GAMEPAD_HOTKEYS_KEY, value);
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

/**
 * Whether the user wants the app to start with Windows; `null` when never
 * recorded. The Run entry itself belongs to Windows and an installer can remove
 * it, so this is what survives a reinstall.
 */
export async function loadAutostartPreference(): Promise<boolean | null> {
  const store = await getStore();
  const stored = await store.get(AUTOSTART_KEY);
  return typeof stored === "boolean" ? stored : null;
}

export async function saveAutostartPreference(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(AUTOSTART_KEY, value);
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

/**
 * What a left-click on each tray icon does. The backend re-reads the file on
 * every click (see `config::tray_click_action`), so saving is all it takes to
 * apply — no command needed, like `bluetoothAutoDisconnect`.
 */
export const TRAY_CLICK_ACTIONS = [
  "flyout",
  "toggleMicMute",
  "toggleOutputMute",
  "cycleOutput",
  "openApp",
  "soundPanel",
] as const;
export type TrayClickAction = (typeof TRAY_CLICK_ACTIONS)[number];

export interface TrayClickConfig {
  mic: TrayClickAction;
  device: TrayClickAction;
}

export const DEFAULT_TRAY_CLICK: TrayClickConfig = {
  mic: "flyout",
  device: "flyout",
};

const TRAY_CLICK_KEY = "trayLeftClick";

export async function loadTrayClick(): Promise<TrayClickConfig> {
  const store = await getStore();
  const stored = await store.get<Partial<TrayClickConfig>>(TRAY_CLICK_KEY);
  return {
    mic: oneOf(stored?.mic, TRAY_CLICK_ACTIONS, DEFAULT_TRAY_CLICK.mic),
    device: oneOf(stored?.device, TRAY_CLICK_ACTIONS, DEFAULT_TRAY_CLICK.device),
  };
}

export async function saveTrayClick(value: TrayClickConfig): Promise<void> {
  const store = await getStore();
  await store.set(TRAY_CLICK_KEY, value);
}

/**
 * Whether the Bluetooth device that stops being the default output gets
 * disconnected when the default changes. Read by the backend on every
 * default-output change; no command needed to apply it live.
 */
export async function loadBtAutoDisconnect(): Promise<boolean> {
  const store = await getStore();
  return boolOr(await store.get(BT_AUTO_DISCONNECT_KEY), false);
}

export async function saveBtAutoDisconnect(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(BT_AUTO_DISCONNECT_KEY, value);
}

/** Whether the mic mute covers every active microphone, not just the default. */
export async function loadMicMuteAll(): Promise<boolean> {
  const store = await getStore();
  return boolOr(await store.get(MIC_MUTE_ALL_KEY), false);
}

export async function saveMicMuteAll(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(MIC_MUTE_ALL_KEY, value);
}

/** Whether the mic mute also sends Win+Alt+K, the Windows call-mute shortcut. */
export async function loadMicMuteCallShortcut(): Promise<boolean> {
  const store = await getStore();
  return boolOr(await store.get(MIC_MUTE_CALL_SHORTCUT_KEY), false);
}

export async function saveMicMuteCallShortcut(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(MIC_MUTE_CALL_SHORTCUT_KEY, value);
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

/**
 * Who draws the window's title bar.
 *
 * `custom` (the default) matches the rest of the UI; `native` hands it back to
 * Windows, which brings back the snap-layouts flyout on the maximize button.
 * That flyout needs the top-level window to answer a hit test, and the webview
 * covers the whole client area, so an app-drawn bar cannot offer it.
 */
export const TITLE_BAR_STYLES = ["custom", "native"] as const;
export type TitleBarStyle = (typeof TITLE_BAR_STYLES)[number];

export async function loadTitleBarStyle(): Promise<TitleBarStyle> {
  const store = await getStore();
  return oneOf(await store.get(TITLE_BAR_KEY), TITLE_BAR_STYLES, "custom");
}

export async function saveTitleBarStyle(value: TitleBarStyle): Promise<void> {
  const store = await getStore();
  await store.set(TITLE_BAR_KEY, value);
}

/**
 * Backdrop of the main window. The floating windows stay solid on purpose
 * (`docs/janela-material.md`). The backend steps a choice down when the OS
 * cannot draw it, so what is stored is a preference, not a promise.
 */
export const WINDOW_MATERIALS = ["mica", "micaAlt", "acrylic", "solid"] as const;
export type WindowMaterial = (typeof WINDOW_MATERIALS)[number];

/** Acrylic: it is what the Windows 11 surfaces use, and the backend steps it down where unsupported. */
export const DEFAULT_WINDOW_MATERIAL: WindowMaterial = "acrylic";

export async function loadWindowMaterial(): Promise<WindowMaterial> {
  const store = await getStore();
  return oneOf(
    await store.get(WINDOW_MATERIAL_KEY),
    WINDOW_MATERIALS,
    DEFAULT_WINDOW_MATERIAL,
  );
}

export async function saveWindowMaterial(value: WindowMaterial): Promise<void> {
  const store = await getStore();
  await store.set(WINDOW_MATERIAL_KEY, value);
}

/**
 * Acrylic on the quick-switch flyout and the tray menu, on by default (the
 * backend keeps them solid below Windows 11 22H2). The backend takes the value
 * from a command (the store writes asynchronously) and falls back to this key
 * at startup.
 */
export async function loadFloatingAcrylic(): Promise<boolean> {
  const store = await getStore();
  return boolOr(await store.get(FLOATING_ACRYLIC_KEY), true);
}

export async function saveFloatingAcrylic(value: boolean): Promise<void> {
  const store = await getStore();
  await store.set(FLOATING_ACRYLIC_KEY, value);
}

export type { DeviceDirection };
