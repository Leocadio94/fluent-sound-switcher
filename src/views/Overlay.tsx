import { useState } from "react";
import { MicProhibitedFilled, MicFilled } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

import { useTauriEvent } from "../hooks/useTauriEvent";

interface OverlayState {
  muted: boolean;
  style: "full" | "icon";
}

// Colours come from Fluent tokens rather than the hardcoded hex values this
// used to carry, so the pill follows the light/dark theme like the rest of the
// app. `colorNeutralBackgroundAlpha` keeps the acrylic look in both themes.
const useStyles = makeStyles({
  pill: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    boxSizing: "border-box",
    height: "48px",
    padding: "0 20px",
    borderRadius: "999px",
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackgroundAlpha,
    backdropFilter: "blur(8px)",
    boxShadow: tokens.shadow16,
    userSelect: "none",
    whiteSpace: "nowrap",
    "& svg": {
      fontSize: "22px",
      flexShrink: 0,
    },
  },
  icon: {
    padding: 0,
    width: "48px",
    gap: 0,
  },
  muted: {
    color: tokens.colorPaletteRedForeground1,
    // Keep the red ring that makes "muted" readable at a glance over a game.
    boxShadow: `0 0 0 1.5px ${tokens.colorPaletteRedBorderActive}, ${tokens.shadow16}`,
  },
  live: {
    color: tokens.colorPaletteGreenForeground1,
  },
});

/**
 * Content of the always-on-top, click-through overlay window. Reflects the mic
 * mute state pushed by the backend via the `overlay-state` event, in either
 * full (icon + text) or icon-only style.
 */
export default function Overlay() {
  const { t } = useTranslation();
  const styles = useStyles();
  const [state, setState] = useState<OverlayState>({
    muted: false,
    style: "full",
  });

  useTauriEvent<OverlayState>("overlay-state", (event) =>
    setState(event.payload),
  );

  const { muted, style } = state;

  return (
    <div
      // Decorative mirror of the tray state, and the window is click-through.
      aria-hidden="true"
      className={mergeClasses(
        styles.pill,
        muted ? styles.muted : styles.live,
        style === "icon" && styles.icon,
      )}
    >
      {muted ? <MicProhibitedFilled /> : <MicFilled />}
      {style !== "icon" && (
        <span>{muted ? t("muteIndicator.muted") : t("muteIndicator.live")}</span>
      )}
    </div>
  );
}
