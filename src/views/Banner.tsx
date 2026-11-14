import { useState } from "react";
import { MicRegular, Speaker2Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { makeStyles, tokens } from "@fluentui/react-components";

import { useTauriEvent } from "../hooks/useTauriEvent";

interface BannerData {
  /** One per banner; the backend's retries of it share the same id. */
  id: number;
  name: string;
  direction: "output" | "input";
}

/** @see docs/visual-windows-11.md */
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
  const [data, setData] = useState<BannerData | null>(null);

  useTauriEvent<BannerData>("banner-show", (event) => setData(event.payload));

  if (!data) return null;
  const Icon = data.direction === "output" ? Speaker2Regular : MicRegular;

  return (
    // Keyed by banner so each one remounts and replays its entrance; a retry
    // carries the same id and leaves it alone. Decorative: the window is
    // click-through.
    <div key={data.id} aria-hidden="true" className={styles.pill}>
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
