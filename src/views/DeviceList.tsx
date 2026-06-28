import { useTranslation } from "react-i18next";
import {
  Badge,
  Body1,
  Caption1,
  Spinner,
  Subtitle2,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  CheckmarkCircleFilled,
  MicRegular,
  Speaker2Regular,
  StarFilled,
  StarRegular,
} from "@fluentui/react-icons";

import type { AudioDevice, DeviceDirection } from "../lib/tauri";

const useStyles = makeStyles({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground2,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusLarge,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  rowActive: {
    border: `${tokens.strokeWidthThin} solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  switchButton: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    flexGrow: 1,
    minWidth: 0,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    border: "none",
    background: "none",
    color: tokens.colorNeutralForeground1,
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: tokens.borderRadiusLarge,
    ":disabled": {
      cursor: "default",
    },
  },
  rowIcon: {
    fontSize: "20px",
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  rowName: {
    flexGrow: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  starButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "32px",
    height: "32px",
    padding: 0,
    border: "none",
    background: "none",
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    fontSize: "20px",
    color: tokens.colorNeutralForeground3,
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
      color: tokens.colorNeutralForeground1,
    },
  },
  starActive: {
    color: tokens.colorPaletteMarigoldForeground1,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalS,
  },
});

interface DeviceSectionProps {
  direction: DeviceDirection;
  devices: AudioDevice[];
  switching: string | null;
  onSwitch: (device: AudioDevice) => void;
  isFavorite: (direction: DeviceDirection, id: string) => boolean;
  onToggleFavorite: (direction: DeviceDirection, id: string) => void;
}

function DeviceSection({
  direction,
  devices,
  switching,
  onSwitch,
  isFavorite,
  onToggleFavorite,
}: DeviceSectionProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const Icon = direction === "output" ? Speaker2Regular : MicRegular;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <Icon />
        <Subtitle2>
          {direction === "output" ? t("common.output") : t("common.input")}
        </Subtitle2>
      </div>
      <div className={styles.list}>
        {devices.length === 0 && (
          <Caption1 className={styles.empty}>{t("common.noDevices")}</Caption1>
        )}
        {devices.map((device) => {
          const favorite = isFavorite(direction, device.id);
          return (
            <div
              key={device.id}
              className={mergeClasses(
                styles.row,
                device.isDefault && styles.rowActive,
              )}
            >
              <button
                type="button"
                disabled={switching !== null}
                className={styles.switchButton}
                onClick={() => onSwitch(device)}
              >
                <Icon className={styles.rowIcon} />
                <Body1 className={styles.rowName}>{device.name}</Body1>
              </button>

              {switching === device.id ? (
                <Spinner size="tiny" />
              ) : device.isDefault ? (
                <Badge
                  appearance="tint"
                  color="brand"
                  icon={<CheckmarkCircleFilled />}
                >
                  {t("common.active")}
                </Badge>
              ) : null}

              <Tooltip
                content={
                  favorite
                    ? t("devices.removeFromCycle")
                    : t("devices.addToCycle")
                }
                relationship="label"
              >
                <button
                  type="button"
                  className={mergeClasses(
                    styles.starButton,
                    favorite && styles.starActive,
                  )}
                  onClick={() => onToggleFavorite(direction, device.id)}
                >
                  {favorite ? <StarFilled /> : <StarRegular />}
                </button>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface DeviceListProps {
  devices: AudioDevice[];
  switching: string | null;
  onSwitch: (device: AudioDevice) => void;
  isFavorite: (direction: DeviceDirection, id: string) => boolean;
  onToggleFavorite: (direction: DeviceDirection, id: string) => void;
  showOnlyFavorites: boolean;
}

export default function DeviceList({
  devices,
  switching,
  onSwitch,
  isFavorite,
  onToggleFavorite,
  showOnlyFavorites,
}: DeviceListProps) {
  const visible = showOnlyFavorites
    ? devices.filter((d) => isFavorite(d.direction, d.id))
    : devices;
  const outputs = visible.filter((d) => d.direction === "output");
  const inputs = visible.filter((d) => d.direction === "input");

  const sectionProps = { switching, onSwitch, isFavorite, onToggleFavorite };

  return (
    <>
      <DeviceSection direction="output" devices={outputs} {...sectionProps} />
      <DeviceSection direction="input" devices={inputs} {...sectionProps} />
    </>
  );
}
