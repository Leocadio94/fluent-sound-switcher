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
  Divider,
  Dropdown,
  Field,
  Option,
  Subtitle2,
  Switch,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

import HotkeyInput from "../components/HotkeyInput";
import type {
  Hotkeys,
  MuteIndicator,
  MuteIndicatorMode,
  NotificationConfig,
  OverlayPosition,
  OverlayStyle,
} from "../lib/config";

const useStyles = makeStyles({
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalM,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  sectionTitle: {
    color: tokens.colorNeutralForeground2,
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalL,
  },
});

const HOTKEY_ACTIONS: { key: keyof Hotkeys; labelKey: string }[] = [
  { key: "cycleOutput", labelKey: "hotkeys.cycleOutput" },
  { key: "cycleInput", labelKey: "hotkeys.cycleInput" },
  { key: "toggleMute", labelKey: "hotkeys.toggleMute" },
];

const MODES: MuteIndicatorMode[] = [
  "always",
  "mutedOnly",
  "unmutedOnly",
  "hidden",
];

const POSITIONS: OverlayPosition[] = [
  "topCenter",
  "bottomCenter",
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
];

const STYLES: OverlayStyle[] = ["full", "icon"];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotkeys: Hotkeys;
  onHotkeyChange: (action: keyof Hotkeys, accelerator: string) => void;
  indicator: MuteIndicator;
  onIndicatorChange: <K extends keyof MuteIndicator>(
    key: K,
    value: MuteIndicator[K],
  ) => void;
  notifications: NotificationConfig;
  onNotificationChange: <K extends keyof NotificationConfig>(
    key: K,
    value: NotificationConfig[K],
  ) => void;
  onPreviewNotification: () => void;
}

export default function SettingsDialog({
  open,
  onOpenChange,
  hotkeys,
  onHotkeyChange,
  indicator,
  onIndicatorChange,
  notifications,
  onNotificationChange,
  onPreviewNotification,
}: SettingsDialogProps) {
  const styles = useStyles();
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogContent className={styles.content}>
            <section className={styles.section}>
              <Subtitle2 className={styles.sectionTitle}>
                {t("hotkeys.title")}
              </Subtitle2>
              {HOTKEY_ACTIONS.map(({ key, labelKey }) => (
                <Field
                  key={key}
                  className={styles.row}
                  label={t(labelKey)}
                  orientation="horizontal"
                >
                  <HotkeyInput
                    value={hotkeys[key]}
                    onChange={(accel) => onHotkeyChange(key, accel)}
                  />
                </Field>
              ))}
            </section>

            <Divider />

            <section className={styles.section}>
              <Subtitle2 className={styles.sectionTitle}>
                {t("muteIndicator.title")}
              </Subtitle2>
              <Field
                className={styles.row}
                label={t("muteIndicator.mode")}
                orientation="horizontal"
              >
                <Dropdown
                  value={t(`muteIndicator.modes.${indicator.mode}`)}
                  selectedOptions={[indicator.mode]}
                  onOptionSelect={(_, data) =>
                    data.optionValue &&
                    onIndicatorChange(
                      "mode",
                      data.optionValue as MuteIndicatorMode,
                    )
                  }
                >
                  {MODES.map((mode) => (
                    <Option key={mode} value={mode}>
                      {t(`muteIndicator.modes.${mode}`)}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field
                className={styles.row}
                label={t("muteIndicator.position")}
                orientation="horizontal"
              >
                <Dropdown
                  value={t(`muteIndicator.positions.${indicator.position}`)}
                  selectedOptions={[indicator.position]}
                  onOptionSelect={(_, data) =>
                    data.optionValue &&
                    onIndicatorChange(
                      "position",
                      data.optionValue as OverlayPosition,
                    )
                  }
                >
                  {POSITIONS.map((pos) => (
                    <Option key={pos} value={pos}>
                      {t(`muteIndicator.positions.${pos}`)}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field
                className={styles.row}
                label={t("muteIndicator.style")}
                orientation="horizontal"
              >
                <Dropdown
                  value={t(`muteIndicator.styles.${indicator.style}`)}
                  selectedOptions={[indicator.style]}
                  onOptionSelect={(_, data) =>
                    data.optionValue &&
                    onIndicatorChange("style", data.optionValue as OverlayStyle)
                  }
                >
                  {STYLES.map((s) => (
                    <Option key={s} value={s}>
                      {t(`muteIndicator.styles.${s}`)}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            </section>

            <Divider />

            <section className={styles.section}>
              <Subtitle2 className={styles.sectionTitle}>
                {t("notifications.title")}
              </Subtitle2>
              <Field
                className={styles.row}
                label={t("notifications.banner")}
                orientation="horizontal"
              >
                <Switch
                  checked={notifications.banner}
                  onChange={(_, d) => onNotificationChange("banner", d.checked)}
                />
              </Field>
              <Field
                className={styles.row}
                label={t("notifications.native")}
                orientation="horizontal"
              >
                <Switch
                  checked={notifications.native}
                  onChange={(_, d) => onNotificationChange("native", d.checked)}
                />
              </Field>
              <Field
                className={styles.row}
                label={t("notifications.sound")}
                orientation="horizontal"
              >
                <Switch
                  checked={notifications.sound}
                  onChange={(_, d) => onNotificationChange("sound", d.checked)}
                />
              </Field>
              <Field
                className={styles.row}
                label={t("notifications.bannerPosition")}
                orientation="horizontal"
              >
                <Dropdown
                  value={t(
                    `muteIndicator.positions.${notifications.bannerPosition}`,
                  )}
                  selectedOptions={[notifications.bannerPosition]}
                  onOptionSelect={(_, data) =>
                    data.optionValue &&
                    onNotificationChange(
                      "bannerPosition",
                      data.optionValue as OverlayPosition,
                    )
                  }
                >
                  {POSITIONS.map((pos) => (
                    <Option key={pos} value={pos}>
                      {t(`muteIndicator.positions.${pos}`)}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Button appearance="secondary" onClick={onPreviewNotification}>
                {t("notifications.test")}
              </Button>
            </section>
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
