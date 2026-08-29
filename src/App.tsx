import { useTranslation } from "react-i18next";
import {
  Body1,
  Button,
  Caption1,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useCallback, useEffect, useState } from "react";

import TitleBar from "./components/TitleBar";
import AppControls from "./components/AppControls";
import DeviceList from "./views/DeviceList";
import SettingsDialog from "./views/SettingsDialog";
import { useDevices } from "./hooks/useDevices";
import { useFavorites } from "./hooks/useFavorites";
import { useHotkeys } from "./hooks/useHotkeys";
import { useMute } from "./hooks/useMute";
import { useMuteIndicator } from "./hooks/useMuteIndicator";
import { useNotifications } from "./hooks/useNotifications";
import { useAutoSwitch } from "./hooks/useAutoSwitch";
import { useVolume } from "./hooks/useVolume";
import { useVolumeOsd } from "./hooks/useVolumeOsd";
import { useTauriEvent } from "./hooks/useTauriEvent";
import {
  installUpdate,
  mainWindowReady,
  previewNotification,
} from "./lib/tauri";
import type { ThemePreference } from "./theme/useSystemTheme";
import type { TitleBarStyle } from "./lib/config";

const useStyles = makeStyles({
  root: {
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    display: "flex",
    alignItems: "center",
    // No app name and no icon: the native title bar already carries both, so
    // this is a toolbar and everything sits at the trailing edge.
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalM,
    // Tighter than before: the window title carries the app name, so the
    // header no longer repeats it.
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalXL}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingHorizontalXL,
    overflowY: "auto",
  },
  // Separates the favorites toggle from the icon buttons that follow it.
  centered: {
    display: "flex",
    justifyContent: "center",
    padding: tokens.spacingVerticalXXL,
  },
  errorDetail: {
    display: "block",
    marginTop: tokens.spacingVerticalXS,
    color: tokens.colorNeutralForeground3,
    wordBreak: "break-word",
  },
});

interface AppProps {
  themePref: ThemePreference;
  onThemePrefChange: (pref: ThemePreference) => void;
  useSystemAccent: boolean;
  onUseSystemAccentChange: (value: boolean) => void;
  titleBarStyle: TitleBarStyle;
  onTitleBarStyleChange: (value: TitleBarStyle) => void;
}

export default function App({
  themePref,
  onThemePrefChange,
  useSystemAccent,
  onUseSystemAccentChange,
  titleBarStyle,
  onTitleBarStyleChange,
}: AppProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { devices, loading, error, refresh, switchTo, switching } =
    useDevices();
  const {
    isFavorite,
    toggleFavorite,
    showOnlyFavorites,
    setShowOnlyFavorites,
  } = useFavorites();
  const { hotkeys, setBinding, failures: hotkeyFailures } = useHotkeys();
  const { indicator, setField: setIndicatorField } = useMuteIndicator();
  const { notifications, setField: setNotificationField } = useNotifications();
  const { autoSwitch, setField: setAutoSwitchField } = useAutoSwitch();
  const { muted, toggle: toggleMute } = useMute();
  const { volumes, setLevel, toggleMute: toggleDeviceMute } = useVolume(devices);
  const { osd, setField: setOsdField } = useVolumeOsd();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [update, setUpdate] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // The window is created hidden so a login auto-start never flashes on
  // screen; reveal it now that the first frame is up.
  useEffect(() => {
    void mainWindowReady();
  }, []);

  // The tray "Configurações" item asks the main window to open settings.
  useTauriEvent("open-settings", () => setSettingsOpen(true));

  // The updater only detects a new version; installing (which restarts the
  // app) stays an explicit user action.
  useTauriEvent<{ version: string }>("update-available", (event) =>
    setUpdate(event.payload.version),
  );
  useTauriEvent(
    "update-finished",
    useCallback(() => {
      setUpdating(false);
      setUpdate(null);
    }, []),
  );

  const controlProps = {
    showOnlyFavorites,
    onShowOnlyFavoritesChange: setShowOnlyFavorites,
    muted,
    onToggleMute: toggleMute,
    onOpenSettings: () => setSettingsOpen(true),
    onRefresh: () => void refresh(),
    refreshing: loading,
  };

  return (
    <div className={styles.root}>
      {/* Windows draws the caption itself in "native" mode. */}
      {titleBarStyle === "custom" && (
        <TitleBar>
          <AppControls {...controlProps} />
        </TitleBar>
      )}
      {/* In "native" mode Windows draws the caption, so the controls need a
          row of their own; in "custom" mode they ride in the title bar. */}
      {titleBarStyle === "native" && (
        <header className={styles.header}>
          <AppControls {...controlProps} />
        </header>
      )}

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        themePref={themePref}
        onThemePrefChange={onThemePrefChange}
        useSystemAccent={useSystemAccent}
        onUseSystemAccentChange={onUseSystemAccentChange}
        titleBarStyle={titleBarStyle}
        onTitleBarStyleChange={onTitleBarStyleChange}
        hotkeys={hotkeys}
        onHotkeyChange={setBinding}
        hotkeyFailures={hotkeyFailures}
        indicator={indicator}
        onIndicatorChange={setIndicatorField}
        notifications={notifications}
        onNotificationChange={setNotificationField}
        onPreviewNotification={() => void previewNotification()}
        autoSwitch={autoSwitch}
        onAutoSwitchChange={setAutoSwitchField}
        volumeOsd={osd}
        onVolumeOsdChange={setOsdField}
      />

      <main className={styles.content}>
        {update && (
          <MessageBar intent="info">
            <MessageBarBody>{t("update.available", { version: update })}</MessageBarBody>
            <MessageBarActions>
              <Button
                appearance="primary"
                size="small"
                disabled={updating}
                onClick={() => {
                  setUpdating(true);
                  void installUpdate();
                }}
              >
                {updating ? t("update.installing") : t("update.install")}
              </Button>
              <Button
                appearance="subtle"
                size="small"
                disabled={updating}
                onClick={() => setUpdate(null)}
              >
                {t("update.later")}
              </Button>
            </MessageBarActions>
          </MessageBar>
        )}

        {error && (
          <MessageBar intent="error" layout="multiline">
            <MessageBarBody>
              {t(`errors.${error.kind}`)}
              {/* The raw backend message is a COM error in English; keep it
                  available for a bug report, but not as the headline. */}
              <Caption1 className={styles.errorDetail}>{error.detail}</Caption1>
            </MessageBarBody>
            <MessageBarActions>
              <Button size="small" onClick={() => void refresh()}>
                {t("errors.retry")}
              </Button>
            </MessageBarActions>
          </MessageBar>
        )}

        {loading ? (
          <div className={styles.centered}>
            <Spinner label={t("common.loading")} />
          </div>
        ) : (
          <>
            <DeviceList
              devices={devices}
              switching={switching}
              onSwitch={(device) => void switchTo(device, true)}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              showOnlyFavorites={showOnlyFavorites}
              volumes={volumes}
              onVolumeChange={setLevel}
              onToggleMute={toggleDeviceMute}
              showSliders={osd.sliders}
            />
          </>
        )}

        {!loading && devices.length === 0 && !error && (
          <Body1>{t("common.noDevices")}</Body1>
        )}
      </main>
    </div>
  );
}
