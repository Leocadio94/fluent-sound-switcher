import { useTranslation } from "react-i18next";
import {
  Caption1,
  Subtitle2,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { MicRegular, Speaker2Regular } from "@fluentui/react-icons";

import DeviceRow from "../components/DeviceRow";
import type { DeviceVolume } from "../hooks/useVolume";
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

interface VolumeProps {
  volumes: Record<string, DeviceVolume>;
  onVolumeChange: (device: AudioDevice, level: number) => void;
  onToggleMute: (device: AudioDevice) => void;
  /** When off, the rows render without their volume slider. */
  showSliders: boolean;
}

interface DeviceSectionProps extends VolumeProps {
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
  volumes,
  onVolumeChange,
  onToggleMute,
  showSliders,
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
              volume={showSliders ? volumes[device.id] : undefined}
              onVolumeChange={showSliders ? onVolumeChange : undefined}
              onToggleMute={showSliders ? onToggleMute : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

interface DeviceListProps extends VolumeProps {
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
  volumes,
  onVolumeChange,
  onToggleMute,
  showSliders,
}: DeviceListProps) {
  // Unavailable devices are kept only when they are favorites: that is the
  // case worth showing, since a sleeping headset would otherwise drop out of
  // the list and out of the cycle order. Every other disconnected endpoint
  // Windows remembers would just be clutter.
  const visible = devices.filter((device) => {
    const favorite = isFavorite(device.direction, device.id);
    if (showOnlyFavorites && !favorite) return false;
    return device.state === "active" || favorite;
  });
  const outputs = visible.filter((d) => d.direction === "output");
  const inputs = visible.filter((d) => d.direction === "input");

  const sectionProps = {
    switching,
    onSwitch,
    isFavorite,
    onToggleFavorite,
    volumes,
    onVolumeChange,
    onToggleMute,
    showSliders,
  };

  return (
    <>
      <DeviceSection direction="output" devices={outputs} {...sectionProps} />
      <DeviceSection direction="input" devices={inputs} {...sectionProps} />
    </>
  );
}
