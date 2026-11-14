import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  MicProhibitedFilled,
  MicFilled,
  Speaker0Regular,
  Speaker2Regular,
  SpeakerMuteRegular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

import { useTauriEvent } from "../hooks/useTauriEvent";
import { getOverlayState, type OverlayState } from "../lib/tauri";
import { useLeaving, useWindowMotion } from "../theme/motion";

/** @see docs/visual-windows-11.md */
const useStyles = makeStyles({
  pill: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    boxSizing: "border-box",
    height: "48px",
    padding: "0 16px",
    borderRadius: tokens.borderRadiusXLarge,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground1,
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
  // Fills the 260 px window (`VOLUME_WIDTH` in overlay.rs) less room for the
  // shadow; a shrink-to-fit pill left the track at zero width.
  volume: {
    width: "calc(100vw - 24px)",
    color: tokens.colorNeutralForeground1,
    gap: "14px",
    fontWeight: tokens.fontWeightRegular,
  },
  track: {
    position: "relative",
    flexGrow: 1,
    height: "4px",
    borderRadius: "999px",
    backgroundColor: tokens.colorNeutralStrokeAccessible,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    insetBlock: 0,
    left: 0,
    borderRadius: "999px",
    backgroundColor: tokens.colorCompoundBrandBackground,
    transitionProperty: "width",
    transitionDuration: tokens.durationFaster,
    transitionTimingFunction: tokens.curveEasyEase,
  },
  // Dimmed rather than recoloured: any fixed grey lands too close to the rail
  // in one of the two themes.
  trackMuted: {
    opacity: 0.4,
  },
  percent: {
    minWidth: "3ch",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
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
  const leaving = useLeaving("overlay-leave", "overlay-state");
  const motion = useWindowMotion("rise", leaving);

  useTauriEvent<OverlayState>("overlay-state", (event) => {
    gotEvent.current = true;
    setState(event.payload);
  });

  // This window is created hidden, so its renderer is frozen and can drop every
  // `overlay-state` event pushed at it. When that happened the component kept
  // its initial guess and drew the wrong face - the text label inside a window
  // sized for the icon-only style, clipped. Ask for the real state on mount,
  // and also ask the backend to re-assert visibility (the first `window.show()`
  // may have missed a still-loading WebView2).
  useEffect(() => {
    void getOverlayState()
      .then((current) => {
        // A real event outranks this: it may describe a volume OSD that the
        // backend is showing right now, which the fetched state does not.
        if (!gotEvent.current) {
          setState(current);
          void invoke("ensure_overlay_visible").catch((e) =>
            console.error("could not ensure overlay visibility", e),
          );
        }
      })
      .catch((e) => console.error("could not read the overlay state", e));
  }, []);

  const { kind, muted, style, level } = state;

  if (kind === "volume") {
    const percent = Math.round(level * 100);
    const VolumeIcon = muted
      ? SpeakerMuteRegular
      : percent === 0
        ? Speaker0Regular
        : Speaker2Regular;
    return (
      <div
        aria-hidden="true"
        className={mergeClasses(styles.pill, styles.volume, motion)}
      >
        <VolumeIcon />
        <div className={mergeClasses(styles.track, muted && styles.trackMuted)}>
          <div className={styles.fill} style={{ width: `${percent}%` }} />
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
        motion,
      )}
    >
      {muted ? <MicProhibitedFilled /> : <MicFilled />}
      {style !== "icon" && (
        <span>{muted ? t("muteIndicator.muted") : t("muteIndicator.live")}</span>
      )}
    </div>
  );
}
