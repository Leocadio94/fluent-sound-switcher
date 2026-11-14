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
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useCallback, useEffect, useMemo, useState } from "react";

import TitleBar from "./components/TitleBar";
import AppControls from "./components/AppControls";
import DeviceList from "./views/DeviceList";
import SettingsDialog from "./views/SettingsDialog";
import { useDevices } from "./hooks/useDevices";
import { useFavorites } from "./hooks/useFavorites";
import { missingFavorites } from "./lib/reconcileFavorites";
import { useHotkeys } from "./hooks/useHotkeys";
import { useGamepadHotkeys } from "./hooks/useGamepadHotkeys";
import { useMute } from "./hooks/useMute";
import { useMicMute } from "./hooks/useMicMute";
import { useMuteIndicator } from "./hooks/useMuteIndicator";
import { useNotifications } from "./hooks/useNotifications";
import { useAutoSwitch } from "./hooks/useAutoSwitch";
import { useBluetooth } from "./hooks/useBluetooth";
import { useRestoreAutostart } from "./hooks/useRestoreAutostart";
import { useVolume } from "./hooks/useVolume";
import { useVolumeOsd } from "./hooks/useVolumeOsd";
import { useTauriEvent } from "./hooks/useTauriEvent";
import {
  installUpdate,
  mainWindowReady,
  previewNotification,
} from "./lib/tauri";
import type { ThemePreference } from "./theme/useSystemTheme";
import type { TitleBarStyle, WindowMaterial } from "./lib/config";

const useStyles = makeStyles({
  root: {
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  // Lets the window's Mica show through; the cards keep their own fill.
  rootTranslucent: {
    backgroundColor: "transparent",
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
  windowMaterial: WindowMaterial;
  onWindowMaterialChange: (value: WindowMaterial) => void;
  /** The window really has a backdrop, so the page must not paint over it. */
  translucent: boolean;
}

export default function App({
  themePref,
  onThemePrefChange,
  useSystemAccent,
  onUseSystemAccentChange,
  titleBarStyle,
  onTitleBarStyleChange,
  windowMaterial,
  onWindowMaterialChange,
  translucent,
}: AppProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { devices, loading, error, refresh, switchTo, switching } =
    useDevices();
  // The only window that reconciles favorites against the device list.
  const {
    favorites,
    isFavorite,
    toggleFavorite,
    removeFavorites,
    showOnlyFavorites,
    setShowOnlyFavorites,
  } = useFavorites(devices);
  const missing = useMemo(
    () => ({
      output: missingFavorites(favorites, devices, "output"),
      input: missingFavorites(favorites, devices, "input"),
    }),
    [favorites, devices],
  );
  const { hotkeys, setBinding, failures: hotkeyFailures } = useHotkeys();
  const { gamepad, setField: setGamepadField } = useGamepadHotkeys();
  const { indicator, setField: setIndicatorField } = useMuteIndicator();
  const micMute = useMicMute();
  const { notifications, setField: setNotificationField } = useNotifications();
  const { autoSwitch, setField: setAutoSwitchField } = useAutoSwitch();
  const bluetooth = useBluetooth();
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

  useRestoreAutostart();

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
    // No radio (or the feature is off): the Bluetooth menu button is hidden.
    bluetooth: bluetooth.available
      ? {
          devices: bluetooth.devices,
          busyMac: bluetooth.busyMac,
          setConnect: bluetooth.setConnect,
        }
      : undefined,
  };

  const toggleBluetooth = (device: (typeof devices)[number]) => {
    if (!device.btMac) return;
    const connected = bluetooth.devices.some(
      (b) => b.mac === device.btMac && b.connected,
    );
    void bluetooth.setConnect(device.btMac, !connected);
  };

  return (
    <div
      className={mergeClasses(styles.root, translucent && styles.rootTranslucent)}
    >
      {/* Windows draws the caption itself in "native" mode. */}
      {titleBarStyle === "custom" && (
        <TitleBar translucent={translucent}>
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
        windowMaterial={windowMaterial}
        onWindowMaterialChange={onWindowMaterialChange}
        hotkeys={hotkeys}
        onHotkeyChange={setBinding}
        hotkeyFailures={hotkeyFailures}
        gamepad={gamepad}
        onGamepadChange={(enabled) => setGamepadField("enabled", enabled)}
        indicator={indicator}
        micMute={micMute}
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

        {bluetooth.error && (
          <MessageBar intent="error" layout="multiline">
            <MessageBarBody>
              {t("bluetooth.error")}
              <Caption1 className={styles.errorDetail}>
                {bluetooth.error}
              </Caption1>
            </MessageBarBody>
            <MessageBarActions>
              <Button size="small" onClick={() => void bluetooth.refresh()}>
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
              missing={missing}
              onRemoveMissing={removeFavorites}
              btDevices={bluetooth.devices}
              btBusyMac={bluetooth.busyMac}
              onBluetoothToggle={bluetooth.available ? toggleBluetooth : undefined}
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
