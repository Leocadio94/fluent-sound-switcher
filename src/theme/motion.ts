import { useState } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";

import { useTauriEvent } from "../hooks/useTauriEvent";

const reduced = { animationDuration: "1ms" } as const;

const useStyles = makeStyles({
  enterRise: {
    animationName: {
      from: { opacity: 0, transform: "translateY(12px)" },
      to: { opacity: 1, transform: "translateY(0)" },
    },
    animationDuration: tokens.durationNormal,
    animationTimingFunction: tokens.curveDecelerateMid,
    animationFillMode: "both",
    "@media (prefers-reduced-motion: reduce)": reduced,
  },
  leaveRise: {
    animationName: {
      from: { opacity: 1, transform: "translateY(0)" },
      to: { opacity: 0, transform: "translateY(12px)" },
    },
    animationDuration: tokens.durationFast,
    animationTimingFunction: tokens.curveAccelerateMid,
    animationFillMode: "both",
    "@media (prefers-reduced-motion: reduce)": reduced,
  },
  enterDrop: {
    animationName: {
      from: { opacity: 0, transform: "translateY(-8px)" },
      to: { opacity: 1, transform: "translateY(0)" },
    },
    animationDuration: tokens.durationNormal,
    animationTimingFunction: tokens.curveDecelerateMid,
    animationFillMode: "both",
    "@media (prefers-reduced-motion: reduce)": reduced,
  },
  leaveDrop: {
    animationName: {
      from: { opacity: 1, transform: "translateY(0)" },
      to: { opacity: 0, transform: "translateY(-8px)" },
    },
    animationDuration: tokens.durationFast,
    animationTimingFunction: tokens.curveAccelerateMid,
    animationFillMode: "both",
    "@media (prefers-reduced-motion: reduce)": reduced,
  },
});

/**
 * Whether the backend is hiding this window: set by `leaveEvent`, cleared by
 * `showEvent`. The webview is suspended while hidden, so the flag is reset by
 * the next show rather than by anything the component could time itself.
 *
 * @see docs/visual-windows-11.md
 */
export function useLeaving(leaveEvent: string, showEvent: string): boolean {
  const [leaving, setLeaving] = useState(false);
  useTauriEvent(leaveEvent, () => setLeaving(true));
  useTauriEvent(showEvent, () => setLeaving(false));
  return leaving;
}

/**
 * Entrance/exit class for a window's root element. Flipping `leaving` swaps the
 * animation, so the entrance replays on every show without remounting.
 *
 * `rise` slides up from below (bottom-anchored windows), `drop` down from above.
 * `none` is for an Acrylic window: the system backdrop cannot move or fade with
 * the content, so animating only the content would leave the glass behind.
 */
export function useWindowMotion(
  from: "rise" | "drop" | "none",
  leaving: boolean,
): string {
  const styles = useStyles();
  if (from === "none") return "";
  if (from === "rise") return leaving ? styles.leaveRise : styles.enterRise;
  return leaving ? styles.leaveDrop : styles.enterDrop;
}
