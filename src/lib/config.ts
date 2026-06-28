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

/** On-screen mute overlay preferences. */
export interface MuteIndicator {
  mode: MuteIndicatorMode;
  position: OverlayPosition;
}

export const DEFAULT_MUTE_INDICATOR: MuteIndicator = {
  mode: "mutedOnly",
  position: "bottomCenter",
};

const STORE_FILE = "config.json";
const FAVORITES_KEY = "favorites";
const ONLY_FAVORITES_KEY = "showOnlyFavorites";
const HOTKEYS_KEY = "hotkeys";
const MUTE_INDICATOR_KEY = "muteIndicator";

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

export type { DeviceDirection };
