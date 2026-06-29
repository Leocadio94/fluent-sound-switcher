import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_MUTE_INDICATOR,
  loadMuteIndicator,
  saveMuteIndicator,
  type MuteIndicator,
} from "../lib/config";
import { refreshMuteIndicator } from "../lib/tauri";

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
  const [indicator, setIndicator] = useState<MuteIndicator>(
    DEFAULT_MUTE_INDICATOR,
  );

  useEffect(() => {
    void loadMuteIndicator().then(setIndicator);
  }, []);

  const setField = useCallback(
    <K extends keyof MuteIndicator>(key: K, value: MuteIndicator[K]) => {
      setIndicator((prev) => {
        const next = { ...prev, [key]: value };
        void saveMuteIndicator(next).then(() => refreshMuteIndicator(next));
        return next;
      });
    },
    [],
  );

  return { indicator, setField };
}
