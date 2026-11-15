import { makeStyles, tokens } from "@fluentui/react-components";
import type { ReactNode } from "react";

const useStyles = makeStyles({
  chip: {
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    padding: `0 ${tokens.spacingHorizontalXS}`,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorSubtleBackgroundHover,
    color: tokens.colorNeutralForeground3,
    font: "inherit",
    fontSize: tokens.fontSizeBase100,
    lineHeight: tokens.lineHeightBase200,
    whiteSpace: "nowrap",
  },
});

/** A keyboard key or shortcut, drawn as the small chip Windows uses for hints. */
export default function KeyChip({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <kbd className={styles.chip}>{children}</kbd>;
}
