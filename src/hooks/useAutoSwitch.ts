import {
  DEFAULT_AUTO_SWITCH,
  loadAutoSwitch,
  saveAutoSwitch,
  type AutoSwitchConfig,
} from "../lib/config";
import { usePersistedConfig } from "./usePersistedConfig";

interface UseAutoSwitch {
  autoSwitch: AutoSwitchConfig;
  setField: <K extends keyof AutoSwitchConfig>(
    key: K,
    value: AutoSwitchConfig[K],
  ) => void;
}

/**
 * Loads and persists the auto-switch-on-connect preferences. The backend reads
 * `config.json` directly when a device connects, so no command round-trip is
 * needed here.
 */
export function useAutoSwitch(): UseAutoSwitch {
  const { value, setField } = usePersistedConfig({
    defaults: DEFAULT_AUTO_SWITCH,
    load: loadAutoSwitch,
    save: saveAutoSwitch,
  });

  return { autoSwitch: value, setField };
}
