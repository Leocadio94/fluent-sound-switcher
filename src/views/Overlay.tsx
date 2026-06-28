import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  MicProhibitedFilled,
  MicFilled,
} from "@fluentui/react-icons";

import "../overlay.css";

/**
 * Content of the always-on-top, click-through overlay window. Reflects the mic
 * mute state pushed by the backend via the `overlay-state` event.
 */
export default function Overlay() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const unlisten = listen<boolean>("overlay-state", (e) =>
      setMuted(e.payload),
    );
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  return (
    <div className={`overlay-pill ${muted ? "is-muted" : "is-live"}`}>
      {muted ? <MicProhibitedFilled /> : <MicFilled />}
      <span>{muted ? "Microfone mudo" : "Microfone ativo"}</span>
    </div>
  );
}
