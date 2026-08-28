import {
  DEFAULT_VOLUME_OSD,
  loadVolumeOsd,
  saveVolumeOsd,
  type VolumeOsd,
} from "../lib/config";
import { usePersistedConfig } from "./usePersistedConfig";

interface UseVolumeOsd {
  osd: VolumeOsd;
  setField: <K extends keyof VolumeOsd>(key: K, value: VolumeOsd[K]) => void;
}

/**
 * Volume OSD and slider preferences. The backend reads `volumeOsd` from
 * `config.json` when a volume hotkey fires, so there is no command to call.
 */
export function useVolumeOsd(): UseVolumeOsd {
  const { value, setField } = usePersistedConfig({
    defaults: DEFAULT_VOLUME_OSD,
    load: loadVolumeOsd,
    save: saveVolumeOsd,
  });

  return { osd: value, setField };
}
