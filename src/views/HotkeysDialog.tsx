import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Field,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

import HotkeyInput from "../components/HotkeyInput";
import type { Hotkeys } from "../lib/config";

const useStyles = makeStyles({
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalM,
  },
  field: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalL,
  },
});

interface HotkeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotkeys: Hotkeys;
  onChange: (action: keyof Hotkeys, accelerator: string) => void;
}

const ACTIONS: { key: keyof Hotkeys; labelKey: string }[] = [
  { key: "cycleOutput", labelKey: "hotkeys.cycleOutput" },
  { key: "cycleInput", labelKey: "hotkeys.cycleInput" },
  { key: "toggleMute", labelKey: "hotkeys.toggleMute" },
];

export default function HotkeysDialog({
  open,
  onOpenChange,
  hotkeys,
  onChange,
}: HotkeysDialogProps) {
  const styles = useStyles();
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t("hotkeys.title")}</DialogTitle>
          <DialogContent className={styles.content}>
            {ACTIONS.map(({ key, labelKey }) => (
              <Field key={key} className={styles.field} label={t(labelKey)} orientation="horizontal">
                <HotkeyInput
                  value={hotkeys[key]}
                  onChange={(accel) => onChange(key, accel)}
                />
              </Field>
            ))}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary">{t("hotkeys.close")}</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
