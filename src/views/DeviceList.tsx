import { useTranslation } from "react-i18next";
import {
  Badge,
  Body1,
  Caption1,
  Spinner,
  Subtitle2,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  CheckmarkCircleFilled,
  MicRegular,
  Speaker2Regular,
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
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusLarge,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    boxSizing: "border-box",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    ":active": {
      backgroundColor: tokens.colorNeutralBackground1Pressed,
    },
  },
  rowActive: {
    border: `${tokens.strokeWidthThin} solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
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
}

function DeviceSection({
  direction,
  devices,
  switching,
  onSwitch,
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
        {devices.map((device) => (
          <button
            key={device.id}
            type="button"
            disabled={switching !== null}
            className={mergeClasses(
              styles.row,
              device.isDefault && styles.rowActive,
            )}
            onClick={() => onSwitch(device)}
          >
            <Icon className={styles.rowIcon} />
            <Body1 className={styles.rowName}>{device.name}</Body1>
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
          </button>
        ))}
      </div>
    </section>
  );
}

interface DeviceListProps {
  devices: AudioDevice[];
  switching: string | null;
  onSwitch: (device: AudioDevice) => void;
}

export default function DeviceList({
  devices,
  switching,
  onSwitch,
}: DeviceListProps) {
  const outputs = devices.filter((d) => d.direction === "output");
  const inputs = devices.filter((d) => d.direction === "input");

  return (
    <>
      <DeviceSection
        direction="output"
        devices={outputs}
        switching={switching}
        onSwitch={onSwitch}
      />
      <DeviceSection
        direction="input"
        devices={inputs}
        switching={switching}
        onSwitch={onSwitch}
      />
    </>
  );
}
