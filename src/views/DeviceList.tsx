import { useTranslation } from "react-i18next";
import {
  Caption1,
  Subtitle2,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { MicRegular, Speaker2Regular } from "@fluentui/react-icons";

import DeviceRow from "../components/DeviceRow";
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
  const heading = direction === "output" ? t("common.output") : t("common.input");

  return (
    <section className={styles.section} aria-label={heading}>
      <div className={styles.sectionHeader}>
        <Icon />
        <Subtitle2>{heading}</Subtitle2>
      </div>
      <div className={styles.list} role="list">
        {devices.length === 0 && (
          <Caption1 className={styles.empty}>{t("common.noDevices")}</Caption1>
        )}
        {devices.map((device) => (
          <div key={device.id} role="listitem">
            <DeviceRow
              device={device}
              variant="full"
              onSwitch={onSwitch}
              // Only the row being switched is disabled; a pending switch used
              // to freeze the entire list.
              busy={switching === device.id}
              favorite={isFavorite(direction, device.id)}
              onToggleFavorite={(d) => onToggleFavorite(direction, d.id)}
            />
          </div>
        ))}
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
