import type { ReactNode } from "react";
import { Caption1, Label, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalXL,
    paddingBlock: tokens.spacingVerticalXS,
  },
  text: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    minWidth: 0,
  },
  hint: {
    color: tokens.colorNeutralForeground3,
  },
  control: {
    flexShrink: 0,
  },
});

interface SettingRowProps {
  label: string;
  /** Optional explanation, shown under the label. */
  hint?: string;
  children: ReactNode;
}

/**
 * One setting: its name (and an optional explanation beneath it) on the left,
 * its control on the right.
 *
 * Fluent's `Field` with `orientation="horizontal"` puts the hint in a third
 * column to the *right* of the control, which squeezed the label into two or
 * three words per line and left the dialog looking cramped. Stacking the hint
 * under the label gives both the full width of the row.
 */
export default function SettingRow({ label, hint, children }: SettingRowProps) {
  const styles = useStyles();
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <Label>{label}</Label>
        {hint && <Caption1 className={styles.hint}>{hint}</Caption1>}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}
