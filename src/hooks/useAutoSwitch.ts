import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_AUTO_SWITCH,
  loadAutoSwitch,
  saveAutoSwitch,
  type AutoSwitchConfig,
} from "../lib/config";

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
  const [autoSwitch, setAutoSwitch] =
    useState<AutoSwitchConfig>(DEFAULT_AUTO_SWITCH);

  useEffect(() => {
    void loadAutoSwitch().then(setAutoSwitch);
  }, []);

  const setField = useCallback(
    <K extends keyof AutoSwitchConfig>(
      key: K,
      value: AutoSwitchConfig[K],
    ) => {
      setAutoSwitch((prev) => {
        const next = { ...prev, [key]: value };
        void saveAutoSwitch(next);
        return next;
      });
    },
    [],
  );

  return { autoSwitch, setField };
}
