import { useTranslation } from "react-i18next";
import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Spinner,
  Switch,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowClockwiseRegular,
  BluetoothConnectedRegular,
  BluetoothDisabledRegular,
  MicProhibitedFilled,
  MicRegular,
  SettingsRegular,
} from "@fluentui/react-icons";

import type { BtDevice } from "../lib/tauri";

const useStyles = makeStyles({
  controls: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  divider: {
    width: tokens.strokeWidthThin,
    alignSelf: "stretch",
    marginBlock: tokens.spacingVerticalXS,
    marginInline: tokens.spacingHorizontalXXS,
    backgroundColor: tokens.colorNeutralStroke2,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalSNudge,
  },
});

/** The part of the Bluetooth hook the menu needs. */
export interface BluetoothMenuProps {
  devices: BtDevice[];
  busyMac: string | null;
  setConnect: (mac: string, enable: boolean) => Promise<void>;
}

interface AppControlsProps {
  showOnlyFavorites: boolean;
  onShowOnlyFavoritesChange: (value: boolean) => void;
  muted: boolean;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  bluetooth?: BluetoothMenuProps;
}

/**
 * The app's own controls: the favourites filter, the mic toggle, settings and
 * refresh.
 *
 * They live in the custom title bar when the app draws it — which is what the
 * caption's empty middle is for — and fall back to a header row when Windows
 * draws the caption instead.
 */
export default function AppControls({
  showOnlyFavorites,
  onShowOnlyFavoritesChange,
  muted,
  onToggleMute,
  onOpenSettings,
  onRefresh,
  refreshing,
  bluetooth,
}: AppControlsProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const BtIcon = bluetooth?.devices.some((d) => d.connected)
    ? BluetoothConnectedRegular
    : BluetoothDisabledRegular;

  return (
    <div className={styles.controls}>
      <Switch
        checked={showOnlyFavorites}
        onChange={(_, data) => onShowOnlyFavoritesChange(data.checked)}
        label={t("devices.onlyFavorites")}
        labelPosition="before"
      />
      <div className={styles.divider} />
      <Tooltip
        content={muted ? t("muteIndicator.muted") : t("muteIndicator.live")}
        relationship="label"
      >
        <Button
          size="small"
          icon={muted ? <MicProhibitedFilled /> : <MicRegular />}
          appearance={muted ? "primary" : "subtle"}
          aria-pressed={muted}
          aria-label={muted ? t("muteIndicator.muted") : t("muteIndicator.live")}
          onClick={onToggleMute}
        />
      </Tooltip>
      <Menu positioning="below-end" hasIcons>
        <MenuTrigger disableButtonEnhancement>
          <Tooltip content={t("bluetooth.menu")} relationship="label">
            <Button
              size="small"
              icon={<BtIcon />}
              appearance="subtle"
              aria-label={t("bluetooth.menu")}
              disabled={!bluetooth}
            />
          </Tooltip>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {bluetooth && bluetooth.devices.length === 0 && (
              <div className={styles.empty}>{t("bluetooth.noDevices")}</div>
            )}
            {bluetooth?.devices.map((device) => (
              <MenuItem
                key={device.mac}
                icon={
                  device.mac === bluetooth.busyMac ? (
                    <Spinner size="tiny" />
                  ) : device.connected ? (
                    <BluetoothConnectedRegular />
                  ) : (
                    <BluetoothDisabledRegular />
                  )
                }
                onClick={() =>
                  void bluetooth.setConnect(device.mac, !device.connected)
                }
              >
                {device.name}
              </MenuItem>
            ))}
          </MenuList>
        </MenuPopover>
      </Menu>
      <Tooltip content={t("settings.title")} relationship="label">
        <Button
          size="small"
          icon={<SettingsRegular />}
          appearance="subtle"
          aria-label={t("settings.title")}
          onClick={onOpenSettings}
        />
      </Tooltip>
      <Tooltip content={t("common.refresh")} relationship="label">
        <Button
          size="small"
          icon={<ArrowClockwiseRegular />}
          appearance="subtle"
          aria-label={t("common.refresh")}
          onClick={onRefresh}
          disabled={refreshing}
        />
      </Tooltip>
    </div>
  );
}
