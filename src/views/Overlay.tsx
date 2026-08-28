import { useEffect, useRef, useState } from "react";
import {
  MicProhibitedFilled,
  MicFilled,
  Speaker0Filled,
  Speaker2Filled,
  SpeakerMuteFilled,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

import { useTauriEvent } from "../hooks/useTauriEvent";
import { getOverlayState, type OverlayState } from "../lib/tauri";

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
  // The volume face is a neutral pill: a level readout is not a state that
  // wants a red or green tint.
  volume: {
    color: tokens.colorNeutralForeground1,
    gap: "14px",
  },
  track: {
    position: "relative",
    flexGrow: 1,
    height: "6px",
    borderRadius: "999px",
    backgroundColor: tokens.colorNeutralBackground5,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    insetBlock: 0,
    left: 0,
    borderRadius: "999px",
    backgroundColor: tokens.colorBrandBackground,
  },
  fillMuted: {
    backgroundColor: tokens.colorNeutralForeground4,
  },
  percent: {
    minWidth: "3ch",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
  },
});

/**
 * Content of the always-on-top, click-through overlay window.
 *
 * Shows either the mic-mute indicator or a transient volume OSD, whichever the
 * backend last pushed through `overlay-state`. They share this one window so
 * the app does not need a fifth WebView2 instance.
 */
export default function Overlay() {
  const { t } = useTranslation();
  const styles = useStyles();
  const [state, setState] = useState<OverlayState>({
    kind: "mute",
    muted: false,
    style: "icon",
    level: 0,
  });
  const gotEvent = useRef(false);

  useTauriEvent<OverlayState>("overlay-state", (event) => {
    gotEvent.current = true;
    setState(event.payload);
  });

  // This window is created hidden, so its renderer is frozen and can drop every
  // `overlay-state` event pushed at it. When that happened the component kept
  // its initial guess and drew the wrong face - the text label inside a window
  // sized for the icon-only style, clipped. Ask for the real state on mount.
  useEffect(() => {
    void getOverlayState()
      .then((current) => {
        // A real event outranks this: it may describe a volume OSD that the
        // backend is showing right now, which the fetched state does not.
        if (!gotEvent.current) setState(current);
      })
      .catch((e) => console.error("could not read the overlay state", e));
  }, []);

  const { kind, muted, style, level } = state;

  if (kind === "volume") {
    const percent = Math.round(level * 100);
    const VolumeIcon = muted
      ? SpeakerMuteFilled
      : percent === 0
        ? Speaker0Filled
        : Speaker2Filled;
    return (
      <div aria-hidden="true" className={mergeClasses(styles.pill, styles.volume)}>
        <VolumeIcon />
        <div className={styles.track}>
          <div
            className={mergeClasses(styles.fill, muted && styles.fillMuted)}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className={styles.percent}>{percent}</span>
      </div>
    );
  }

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
