import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { MicProhibitedFilled, MicFilled } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import "../overlay.css";

interface OverlayState {
  muted: boolean;
  style: "full" | "icon";
}

/**
 * Content of the always-on-top, click-through overlay window. Reflects the mic
 * mute state pushed by the backend via the `overlay-state` event, in either
 * full (icon + text) or icon-only style.
 */
export default function Overlay() {
  const { t } = useTranslation();
  const [state, setState] = useState<OverlayState>({
    muted: false,
    style: "full",
  });

  useEffect(() => {
    const unlisten = listen<OverlayState>("overlay-state", (e) =>
      setState(e.payload),
    );
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  const { muted, style } = state;

  return (
    <div
      className={`overlay-pill ${muted ? "is-muted" : "is-live"} ${
        style === "icon" ? "is-icon" : ""
      }`}
    >
      {muted ? <MicProhibitedFilled /> : <MicFilled />}
      {style !== "icon" && (
        <span>{muted ? t("muteIndicator.muted") : t("muteIndicator.live")}</span>
      )}
    </div>
  );
}
