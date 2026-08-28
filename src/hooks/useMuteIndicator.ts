import {
  DEFAULT_MUTE_INDICATOR,
  loadMuteIndicator,
  saveMuteIndicator,
  type MuteIndicator,
} from "../lib/config";
import { refreshMuteIndicator } from "../lib/tauri";
import { usePersistedConfig } from "./usePersistedConfig";

interface UseMuteIndicator {
  indicator: MuteIndicator;
  setField: <K extends keyof MuteIndicator>(
    key: K,
    value: MuteIndicator[K],
  ) => void;
}

/**
 * Loads and persists the on-screen mute overlay preferences, asking the
 * backend to re-apply the overlay after each change.
 */
export function useMuteIndicator(): UseMuteIndicator {
  const { value, setField } = usePersistedConfig({
    defaults: DEFAULT_MUTE_INDICATOR,
    load: loadMuteIndicator,
    save: saveMuteIndicator,
    apply: refreshMuteIndicator,
  });

  return { indicator: value, setField };
}
