import { useState } from "react";
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
  Dropdown,
  Field,
  Option,
  Switch,
  Tab,
  TabList,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

import HotkeyInput from "../components/HotkeyInput";
import { useGeneral } from "../hooks/useGeneral";
import { SUPPORTED_LANGUAGES } from "../i18n";
import type { ThemePreference } from "../theme/useSystemTheme";
import type {
  AutoSwitchConfig,
  AutoSwitchMode,
  Hotkeys,
  MuteIndicator,
  MuteIndicatorMode,
  NotificationConfig,
  OverlayPosition,
  OverlayStyle,
} from "../lib/config";

const useStyles = makeStyles({
  surface: { width: "560px", maxWidth: "92vw" },
  body: { display: "flex", flexDirection: "column" },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalL,
    minHeight: "260px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalL,
  },
  testRow: { marginTop: tokens.spacingVerticalS },
});

const THEME_OPTIONS: ThemePreference[] = ["system", "light", "dark"];
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
const AUTO_SWITCH_MODES: AutoSwitchMode[] = ["favoritesOnly", "any"];
const HOTKEY_ACTIONS: { key: keyof Hotkeys; labelKey: string }[] = [
  { key: "cycleOutput", labelKey: "hotkeys.cycleOutput" },
  { key: "cycleInput", labelKey: "hotkeys.cycleInput" },
  { key: "toggleMute", labelKey: "hotkeys.toggleMute" },
];

type TabValue = "general" | "hotkeys" | "mute" | "notifications";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themePref: ThemePreference;
  onThemePrefChange: (pref: ThemePreference) => void;
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
  autoSwitch: AutoSwitchConfig;
  onAutoSwitchChange: <K extends keyof AutoSwitchConfig>(
    key: K,
    value: AutoSwitchConfig[K],
  ) => void;
}

export default function SettingsDialog(props: SettingsDialogProps) {
  const {
    open,
    onOpenChange,
    themePref,
    onThemePrefChange,
    hotkeys,
    onHotkeyChange,
    indicator,
    onIndicatorChange,
    notifications,
    onNotificationChange,
    onPreviewNotification,
    autoSwitch,
    onAutoSwitchChange,
  } = props;
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const general = useGeneral();
  const [tab, setTab] = useState<TabValue>("general");

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface className={styles.surface}>
        <DialogBody className={styles.body}>
          <DialogTitle>{t("settings.title")}</DialogTitle>

          <TabList
            selectedValue={tab}
            onTabSelect={(_, d) => setTab(d.value as TabValue)}
          >
            <Tab value="general">{t("settings.tabs.general")}</Tab>
            <Tab value="hotkeys">{t("settings.tabs.hotkeys")}</Tab>
            <Tab value="mute">{t("settings.tabs.mute")}</Tab>
            <Tab value="notifications">{t("settings.tabs.notifications")}</Tab>
          </TabList>

          <DialogContent className={styles.content}>
            {tab === "general" && (
              <>
                <Field
                  className={styles.row}
                  label={t("settings.language")}
                  orientation="horizontal"
                >
                  <Dropdown
                    value={
                      SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)
                        ?.label ?? i18n.language
                    }
                    selectedOptions={[i18n.language]}
                    onOptionSelect={(_, d) =>
                      d.optionValue && i18n.changeLanguage(d.optionValue)
                    }
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <Option key={lang.code} value={lang.code}>
                        {lang.label}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field
                  className={styles.row}
                  label={t("settings.theme")}
                  orientation="horizontal"
                >
                  <Dropdown
                    value={t(`settings.theme.${themePref}`)}
                    selectedOptions={[themePref]}
                    onOptionSelect={(_, d) =>
                      d.optionValue &&
                      onThemePrefChange(d.optionValue as ThemePreference)
                    }
                  >
                    {THEME_OPTIONS.map((opt) => (
                      <Option key={opt} value={opt}>
                        {t(`settings.theme.${opt}`)}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field
                  className={styles.row}
                  label={t("settings.autostart")}
                  orientation="horizontal"
                >
                  <Switch
                    checked={general.autostart}
                    onChange={(_, d) => general.setAutostart(d.checked)}
                  />
                </Field>
                <Field
                  className={styles.row}
                  label={t("settings.startMinimized")}
                  orientation="horizontal"
                >
                  <Switch
                    checked={general.startMinimized}
                    disabled={!general.autostart}
                    onChange={(_, d) => general.setStartMinimized(d.checked)}
                  />
                </Field>
                <Field
                  className={styles.row}
                  label={t("autoSwitch.enabled")}
                  hint={t("autoSwitch.hint")}
                  orientation="horizontal"
                >
                  <Switch
                    checked={autoSwitch.enabled}
                    onChange={(_, d) =>
                      onAutoSwitchChange("enabled", d.checked)
                    }
                  />
                </Field>
                <Field
                  className={styles.row}
                  label={t("autoSwitch.mode")}
                  orientation="horizontal"
                >
                  <Dropdown
                    disabled={!autoSwitch.enabled}
                    value={t(`autoSwitch.modes.${autoSwitch.mode}`)}
                    selectedOptions={[autoSwitch.mode]}
                    onOptionSelect={(_, d) =>
                      d.optionValue &&
                      onAutoSwitchChange("mode", d.optionValue as AutoSwitchMode)
                    }
                  >
                    {AUTO_SWITCH_MODES.map((m) => (
                      <Option key={m} value={m}>
                        {t(`autoSwitch.modes.${m}`)}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </>
            )}

            {tab === "hotkeys" &&
              HOTKEY_ACTIONS.map(({ key, labelKey }) => (
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

            {tab === "mute" && (
              <>
                <Field
                  className={styles.row}
                  label={t("muteIndicator.mode")}
                  orientation="horizontal"
                >
                  <Dropdown
                    value={t(`muteIndicator.modes.${indicator.mode}`)}
                    selectedOptions={[indicator.mode]}
                    onOptionSelect={(_, d) =>
                      d.optionValue &&
                      onIndicatorChange("mode", d.optionValue as MuteIndicatorMode)
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
                    onOptionSelect={(_, d) =>
                      d.optionValue &&
                      onIndicatorChange(
                        "position",
                        d.optionValue as OverlayPosition,
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
                    onOptionSelect={(_, d) =>
                      d.optionValue &&
                      onIndicatorChange("style", d.optionValue as OverlayStyle)
                    }
                  >
                    {STYLES.map((s) => (
                      <Option key={s} value={s}>
                        {t(`muteIndicator.styles.${s}`)}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </>
            )}

            {tab === "notifications" && (
              <>
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
                    onOptionSelect={(_, d) =>
                      d.optionValue &&
                      onNotificationChange(
                        "bannerPosition",
                        d.optionValue as OverlayPosition,
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
                <div className={styles.testRow}>
                  <Button appearance="secondary" onClick={onPreviewNotification}>
                    {t("notifications.test")}
                  </Button>
                </div>
              </>
            )}
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
