import { useCallback, useEffect, useState } from "react";

import { getMicMuted, toggleMicMute } from "../lib/tauri";
import { useTauriEvent } from "./useTauriEvent";

interface UseMute {
  muted: boolean;
  toggle: () => void;
}

/**
 * Tracks the mic mute state, staying in sync with hotkey/tray toggles via the
 * backend's `mic-mute-changed` event.
 */
export function useMute(): UseMute {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    void getMicMuted()
      .then(setMuted)
      .catch((e) => console.error("could not read the mic mute state", e));
  }, []);

  useTauriEvent<boolean>("mic-mute-changed", (event) => setMuted(event.payload));

  const toggle = useCallback(() => {
    void toggleMicMute()
      .then(setMuted)
      .catch((e) => console.error("could not toggle the mic mute", e));
  }, []);

  return { muted, toggle };
}
