import { useState } from "react";
import { MicFilled, Speaker2Filled } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { makeStyles, tokens } from "@fluentui/react-components";

import { useTauriEvent } from "../hooks/useTauriEvent";

interface BannerData {
  name: string;
  direction: "output" | "input";
}

// Fluent tokens instead of the hardcoded hex this used to carry, so the banner
// follows the light/dark theme like the rest of the app.
const useStyles = makeStyles({
  pill: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    boxSizing: "border-box",
    maxWidth: "calc(100vw - 16px)",
    padding: "12px 22px",
    borderRadius: tokens.borderRadiusXLarge,
    fontFamily: tokens.fontFamilyBase,
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackgroundAlpha,
    backdropFilter: "blur(10px)",
    boxShadow: tokens.shadow28,
    userSelect: "none",
    animationName: {
      from: { opacity: 0, transform: "translateY(-8px)" },
      to: { opacity: 1, transform: "translateY(0)" },
    },
    animationDuration: tokens.durationGentle,
    animationTimingFunction: tokens.curveDecelerateMid,
    "& svg": {
      fontSize: "28px",
      flexShrink: 0,
      color: tokens.colorBrandForeground1,
    },
  },
  text: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  label: {
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    color: tokens.colorNeutralForeground3,
  },
  name: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
  const Icon = data.direction === "output" ? Speaker2Filled : MicFilled;

  return (
    // Decorative: the window is click-through and mirrors a change the user
    // just made.
    <div aria-hidden="true" className={styles.pill}>
      <Icon />
      <div className={styles.text}>
        <span className={styles.label}>
          {data.direction === "output" ? t("common.output") : t("common.input")}
        </span>
        <span className={styles.name}>{data.name}</span>
      </div>
    </div>
  );
}
