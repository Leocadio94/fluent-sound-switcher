import type { ReactNode } from "react";
import { Caption1, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { InfoRegular, WarningRegular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  notice: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  warning: {
    border: `${tokens.strokeWidthThin} solid ${tokens.colorPaletteDarkOrangeBorderActive}`,
    backgroundColor: tokens.colorPaletteDarkOrangeBackground1,
  },
  icon: {
    flexShrink: 0,
    fontSize: "16px",
    // Nudged to sit on the first line's baseline rather than the box's top.
    marginTop: "2px",
    color: tokens.colorNeutralForeground3,
  },
  warningIcon: {
    color: tokens.colorPaletteDarkOrangeForeground1,
  },
  text: {
    color: tokens.colorNeutralForeground2,
  },
});

interface SettingsNoticeProps {
  intent?: "info" | "warning";
  children: ReactNode;
}

/**
 * A short explanatory note above a group of settings.
 *
 * Fluent's `MessageBar` is the obvious component for this and it does not work
 * here: even with `layout="multiline"` it sizes its box for two lines, so a
 * third one is drawn outside the border. This is a plain box that grows with
 * whatever it holds.
 */
export default function SettingsNotice({
  intent = "info",
  children,
}: SettingsNoticeProps) {
  const styles = useStyles();
  const warning = intent === "warning";
  const Icon = warning ? WarningRegular : InfoRegular;

  return (
    <div
      role="note"
      className={mergeClasses(styles.notice, warning && styles.warning)}
    >
      <Icon className={mergeClasses(styles.icon, warning && styles.warningIcon)} />
      <Caption1 className={styles.text}>{children}</Caption1>
    </div>
  );
}
