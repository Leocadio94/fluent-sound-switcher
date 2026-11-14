import { useRef, useState } from "react";
import { MicRegular, Speaker2Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { makeStyles, tokens } from "@fluentui/react-components";

import { useTauriEvent } from "../hooks/useTauriEvent";

interface BannerData {
  name: string;
  direction: "output" | "input";
}

/**
 * The backend re-emits each banner at 80/200/400 ms to reach a webview that was
 * still waking up (see `banner.rs`). Anything identical inside this window is
 * one of those, not a new banner.
 */
const RETRY_WINDOW_MS = 700;

// Same card as the volume OSD: opaque surface, hairline border, 8px corner. The
// device icon is neutral rather than the accent, which has no contrast left
// against a dark card for a dark Windows accent.
const useStyles = makeStyles({
  pill: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxSizing: "border-box",
    maxWidth: "calc(100vw - 16px)",
    padding: "12px 20px 12px 16px",
    borderRadius: tokens.borderRadiusXLarge,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    fontFamily: tokens.fontFamilyBase,
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    userSelect: "none",
    animationName: {
      from: { opacity: 0, transform: "translateY(-8px)" },
      to: { opacity: 1, transform: "translateY(0)" },
    },
    animationDuration: tokens.durationNormal,
    animationTimingFunction: tokens.curveDecelerateMid,
    animationFillMode: "both",
    "& svg": {
      fontSize: "24px",
      flexShrink: 0,
    },
  },
  text: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  name: {
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  label: {
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    color: tokens.colorNeutralForeground2,
  },
});

/**
 * Transient toast shown in the banner window when the default device changes.
 * Driven by the backend's `banner-show` event.
 */
export default function Banner() {
  const { t } = useTranslation();
  const styles = useStyles();
  // `id` is the React key: a new banner remounts the card so its entrance plays
  // again. Without it the window kept the same element and only the first
  // banner ever animated.
  const [shown, setShown] = useState<{ data: BannerData; id: number } | null>(
    null,
  );
  const burst = useRef({ name: "", direction: "", at: 0 });

  useTauriEvent<BannerData>("banner-show", (event) => {
    const data = event.payload;
    const now = Date.now();
    const retry =
      burst.current.name === data.name &&
      burst.current.direction === data.direction &&
      now - burst.current.at < RETRY_WINDOW_MS;
    if (!retry) burst.current = { name: data.name, direction: data.direction, at: now };
    setShown((prev) => ({
      data,
      id: retry && prev ? prev.id : (prev?.id ?? 0) + 1,
    }));
  });

  if (!shown) return null;
  const { data } = shown;
  const Icon = data.direction === "output" ? Speaker2Regular : MicRegular;

  return (
    // Decorative: the window is click-through and mirrors a change the user
    // just made.
    <div key={shown.id} aria-hidden="true" className={styles.pill}>
      <Icon />
      <div className={styles.text}>
        <span className={styles.name}>{data.name}</span>
        <span className={styles.label}>
          {data.direction === "output" ? t("banner.output") : t("banner.input")}
        </span>
      </div>
    </div>
  );
}
