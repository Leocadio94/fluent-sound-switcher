import { useCallback, useEffect, useState } from "react";

import {
  loadMicMuteAll,
  loadMicMuteCallShortcut,
  saveMicMuteAll,
  saveMicMuteCallShortcut,
} from "../lib/config";

interface UseMicMute {
  allDevices: boolean;
  setAllDevices: (value: boolean) => void;
  callShortcut: boolean;
  setCallShortcut: (value: boolean) => void;
}

/**
 * How the microphone mute behaves. The backend re-reads both flags on every
 * toggle, so saving is all it takes to apply them.
 */
export function useMicMute(): UseMicMute {
  const [allDevices, setAllDevicesState] = useState(false);
  const [callShortcut, setCallShortcutState] = useState(false);

  useEffect(() => {
    void loadMicMuteAll().then(setAllDevicesState);
    void loadMicMuteCallShortcut().then(setCallShortcutState);
  }, []);

  const setAllDevices = useCallback((value: boolean) => {
    setAllDevicesState(value);
    void saveMicMuteAll(value);
  }, []);

  const setCallShortcut = useCallback((value: boolean) => {
    setCallShortcutState(value);
    void saveMicMuteCallShortcut(value);
  }, []);

  return { allDevices, setAllDevices, callShortcut, setCallShortcut };
}
