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
  Tab,
  TabList,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

import GeneralTab from "./settings/GeneralTab";
import HotkeysTab from "./settings/HotkeysTab";
import MuteTab from "./settings/MuteTab";
import NotificationsTab from "./settings/NotificationsTab";
import VolumeTab from "./settings/VolumeTab";
import type { ThemePreference } from "../theme/useSystemTheme";
import type { HotkeyFailure } from "../lib/tauri";
import type {
  AutoSwitchConfig,
  Hotkeys,
  MuteIndicator,
  NotificationConfig,
  TitleBarStyle,
  VolumeOsd,
} from "../lib/config";

const useStyles = makeStyles({
  surface: { width: "560px", maxWidth: "92vw" },
  body: { display: "flex", flexDirection: "column" },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalL,
    // The tabs differ a lot in height (General has eight fields, Hotkeys
    // three), so pin the panel and scroll inside it rather than let the dialog
    // jump around as the user moves between tabs.
    height: "420px",
    maxHeight: "60vh",
    overflowY: "auto",
  },
});

type TabValue = "general" | "hotkeys" | "volume" | "mute" | "notifications";

const TABS: TabValue[] = [
  "general",
  "hotkeys",
  "volume",
  "mute",
  "notifications",
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themePref: ThemePreference;
  onThemePrefChange: (pref: ThemePreference) => void;
  useSystemAccent: boolean;
  onUseSystemAccentChange: (value: boolean) => void;
  titleBarStyle: TitleBarStyle;
  onTitleBarStyleChange: (value: TitleBarStyle) => void;
  hotkeys: Hotkeys;
  onHotkeyChange: (action: keyof Hotkeys, accelerator: string) => void;
  hotkeyFailures: HotkeyFailure[];
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
  volumeOsd: VolumeOsd;
  onVolumeOsdChange: <K extends keyof VolumeOsd>(
    key: K,
    value: VolumeOsd[K],
  ) => void;
}

/**
 * Tabbed settings. Each tab lives in its own component under `settings/`; this
 * file is only the shell.
 */
export default function SettingsDialog(props: SettingsDialogProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabValue>("general");

  return (
    <Dialog
      open={props.open}
      onOpenChange={(_, data) => props.onOpenChange(data.open)}
    >
      <DialogSurface className={styles.surface}>
        <DialogBody className={styles.body}>
          <DialogTitle>{t("settings.title")}</DialogTitle>

          <TabList
            selectedValue={tab}
            onTabSelect={(_, d) => setTab(d.value as TabValue)}
          >
            {TABS.map((value) => (
              <Tab key={value} value={value}>
                {t(`settings.tabs.${value}`)}
              </Tab>
            ))}
          </TabList>

          <DialogContent className={styles.content}>
            {tab === "general" && (
              <GeneralTab
                themePref={props.themePref}
                onThemePrefChange={props.onThemePrefChange}
                useSystemAccent={props.useSystemAccent}
                onUseSystemAccentChange={props.onUseSystemAccentChange}
                titleBarStyle={props.titleBarStyle}
                onTitleBarStyleChange={props.onTitleBarStyleChange}
                autoSwitch={props.autoSwitch}
                onAutoSwitchChange={props.onAutoSwitchChange}
              />
            )}
            {tab === "hotkeys" && (
              <HotkeysTab
                hotkeys={props.hotkeys}
                onChange={props.onHotkeyChange}
                failures={props.hotkeyFailures}
              />
            )}
            {tab === "volume" && (
              <VolumeTab
                osd={props.volumeOsd}
                onChange={props.onVolumeOsdChange}
              />
            )}
            {tab === "mute" && (
              <MuteTab
                indicator={props.indicator}
                onChange={props.onIndicatorChange}
              />
            )}
            {tab === "notifications" && (
              <NotificationsTab
                notifications={props.notifications}
                onChange={props.onNotificationChange}
                onPreview={props.onPreviewNotification}
              />
            )}
          </DialogContent>

          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary">{t("common.close")}</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
