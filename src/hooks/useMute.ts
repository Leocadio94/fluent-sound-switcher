import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import { getMicMuted, toggleMicMute } from "../lib/tauri";

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
      .catch(() => {});
    const unlisten = listen<boolean>("mic-mute-changed", (e) =>
      setMuted(e.payload),
    );
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  const toggle = useCallback(() => {
    void toggleMicMute()
      .then(setMuted)
      .catch(() => {});
  }, []);

  return { muted, toggle };
}
