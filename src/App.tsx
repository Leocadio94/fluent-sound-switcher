import { useTranslation } from "react-i18next";
import {
  Body1,
  Button,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Switch,
  Title2,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  ArrowClockwiseRegular,
  MicProhibitedFilled,
  MicRegular,
  SettingsRegular,
} from "@fluentui/react-icons";

import DeviceList from "./views/DeviceList";
import SettingsDialog from "./views/SettingsDialog";
import { useDevices } from "./hooks/useDevices";
import { useFavorites } from "./hooks/useFavorites";
import { useHotkeys } from "./hooks/useHotkeys";
import { useMute } from "./hooks/useMute";
import { useMuteIndicator } from "./hooks/useMuteIndicator";
import { useNotifications } from "./hooks/useNotifications";
import { useAutoSwitch } from "./hooks/useAutoSwitch";
import {
  installUpdate,
  mainWindowReady,
  previewNotification,
} from "./lib/tauri";
import type { ThemePreference } from "./theme/useSystemTheme";

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
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXL}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  headerControls: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingHorizontalXL,
    overflowY: "auto",
  },
  toolbar: {
    display: "flex",
    justifyContent: "flex-end",
  },
  centered: {
    display: "flex",
    justifyContent: "center",
    padding: tokens.spacingVerticalXXL,
  },
});

interface AppProps {
  themePref: ThemePreference;
  onThemePrefChange: (pref: ThemePreference) => void;
}

export default function App({ themePref, onThemePrefChange }: AppProps) {
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
  const { hotkeys, setBinding } = useHotkeys();
  const { indicator, setField: setIndicatorField } = useMuteIndicator();
  const { notifications, setField: setNotificationField } = useNotifications();
  const { autoSwitch, setField: setAutoSwitchField } = useAutoSwitch();
  const { muted, toggle: toggleMute } = useMute();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [update, setUpdate] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // The window is created hidden so a login auto-start never flashes on
  // screen; reveal it now that the first frame is up.
  useEffect(() => {
    void mainWindowReady();
  }, []);

  // The tray "Configurações" item asks the main window to open settings.
  useEffect(() => {
    const unlisten = listen("open-settings", () => setSettingsOpen(true));
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  // The updater only detects a new version; installing (which restarts the
  // app) stays an explicit user action.
  useEffect(() => {
    const unlistenAvailable = listen<{ version: string }>(
      "update-available",
      (event) => setUpdate(event.payload.version),
    );
    const unlistenFinished = listen("update-finished", () => {
      setUpdating(false);
      setUpdate(null);
    });
    return () => {
      void unlistenAvailable.then((off) => off());
      void unlistenFinished.then((off) => off());
    };
  }, []);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Title2>{t("app.title")}</Title2>
        <div className={styles.headerControls}>
          <Tooltip
            content={muted ? t("muteIndicator.muted") : t("muteIndicator.live")}
            relationship="label"
          >
            <Button
              icon={muted ? <MicProhibitedFilled /> : <MicRegular />}
              appearance={muted ? "primary" : "subtle"}
              onClick={toggleMute}
            />
          </Tooltip>
          <Tooltip content={t("settings.title")} relationship="label">
            <Button
              icon={<SettingsRegular />}
              appearance="subtle"
              onClick={() => setSettingsOpen(true)}
            />
          </Tooltip>
          <Tooltip content={t("common.refresh")} relationship="label">
            <Button
              icon={<ArrowClockwiseRegular />}
              appearance="subtle"
              onClick={() => void refresh()}
              disabled={loading}
            />
          </Tooltip>
        </div>
      </header>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        themePref={themePref}
        onThemePrefChange={onThemePrefChange}
        hotkeys={hotkeys}
        onHotkeyChange={setBinding}
        indicator={indicator}
        onIndicatorChange={setIndicatorField}
        notifications={notifications}
        onNotificationChange={setNotificationField}
        onPreviewNotification={() => void previewNotification()}
        autoSwitch={autoSwitch}
        onAutoSwitchChange={setAutoSwitchField}
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
          <MessageBar intent="error">
            <MessageBarBody>
              {t("common.error")}: {error}
            </MessageBarBody>
          </MessageBar>
        )}

        {loading ? (
          <div className={styles.centered}>
            <Spinner label={t("common.loading")} />
          </div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <Switch
                checked={showOnlyFavorites}
                onChange={(_, data) => setShowOnlyFavorites(data.checked)}
                label={t("devices.onlyFavorites")}
                labelPosition="before"
              />
            </div>
            <DeviceList
              devices={devices}
              switching={switching}
              onSwitch={(device) => void switchTo(device, true)}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              showOnlyFavorites={showOnlyFavorites}
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
