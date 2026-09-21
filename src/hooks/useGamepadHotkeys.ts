import {
  DEFAULT_GAMEPAD_HOTKEYS,
  loadGamepadHotkeys,
  saveGamepadHotkeys,
  type GamepadHotkeys,
} from "../lib/config";
import { updateGamepadHotkeys } from "../lib/tauri";
import { usePersistedConfig } from "./usePersistedConfig";

interface UseGamepadHotkeys {
  gamepad: GamepadHotkeys;
  setField: <K extends keyof GamepadHotkeys>(
    key: K,
    value: GamepadHotkeys[K],
  ) => void;
}

/**
 * Loads and persists the gamepad-shortcut preferences, handing the toggle to
 * the backend live — the polling thread reads the flag, not the store file.
 */
export function useGamepadHotkeys(): UseGamepadHotkeys {
  const { value, setField } = usePersistedConfig({
    defaults: DEFAULT_GAMEPAD_HOTKEYS,
    load: loadGamepadHotkeys,
    save: saveGamepadHotkeys,
    apply: updateGamepadHotkeys,
  });

  return { gamepad: value, setField };
}
