import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Body1,
  Slider,
  Spinner,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  CheckmarkCircleFilled,
  ChevronDownRegular,
  ChevronUpRegular,
  MicRegular,
  Speaker0Regular,
  Speaker2Regular,
  SpeakerMuteRegular,
  StarFilled,
  StarRegular,
} from "@fluentui/react-icons";

import type { DeviceVolume } from "../hooks/useVolume";
import type { AudioDevice } from "../lib/tauri";

/**
 * `full` is the main window's list (bordered card, active badge, favorite
 * star); `compact` is the tray flyout (dense row, checkmark only). They used to
 * be two hand-rolled copies of the same markup and near-identical `makeStyles`
 * blocks in `DeviceList` and `Flyout`.
 */
export type DeviceRowVariant = "full" | "compact";

const useStyles = makeStyles({
  // The frame lives on the outer container so the optional volume row sits
  // inside the same card as the device name.
  frame: {
    display: "flex",
    flexDirection: "column",
    borderRadius: tokens.borderRadiusLarge,
  },
  frameFull: {
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  frameFullActive: {
    border: `${tokens.strokeWidthThin} solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  frameCompactActive: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  headerFull: {
    paddingRight: tokens.spacingHorizontalS,
  },
  button: {
    display: "flex",
    alignItems: "center",
    flexGrow: 1,
    minWidth: 0,
    border: "none",
    background: "none",
    color: tokens.colorNeutralForeground1,
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: tokens.borderRadiusLarge,
    ":disabled": { cursor: "default", opacity: 0.6 },
    // Custom buttons lose the default focus ring once `border` is cleared, so
    // put a visible one back for keyboard users.
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "-2px",
    },
  },
  buttonFull: {
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  buttonCompact: {
    gap: tokens.spacingHorizontalS,
    width: "100%",
    boxSizing: "border-box",
    padding: `${tokens.spacingVerticalSNudge} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  icon: {
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  iconFull: { fontSize: "20px" },
  iconCompact: { fontSize: "18px" },
  name: {
    flexGrow: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  nameCompact: { fontSize: tokens.fontSizeBase300 },
  check: { color: tokens.colorBrandForeground1, flexShrink: 0 },
  checkFull: { fontSize: "18px" },
  star: {
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
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
    },
  },
  starActive: { color: tokens.colorPaletteMarigoldForeground1 },
  chevron: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "28px",
    height: "28px",
    padding: 0,
    border: "none",
    background: "none",
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    fontSize: "16px",
    color: tokens.colorNeutralForeground3,
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
      color: tokens.colorNeutralForeground1,
    },
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
    },
  },

  // The volume row sits under the device name, indented to line up with it.
  volumeRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    padding: `0 ${tokens.spacingHorizontalM} ${tokens.spacingVerticalXS}`,
  },
  volumeRowCompact: {
    padding: `0 ${tokens.spacingHorizontalS} ${tokens.spacingVerticalXXS}`,
  },
  muteButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "28px",
    height: "28px",
    padding: 0,
    border: "none",
    background: "none",
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    fontSize: "16px",
    color: tokens.colorNeutralForeground3,
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
      color: tokens.colorNeutralForeground1,
    },
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
    },
  },
  muteButtonActive: { color: tokens.colorPaletteRedForeground1 },
  // Capped: a volume slider spanning the whole row reads as a progress bar,
  // and the pointer has to travel further than the control deserves.
  slider: { flexGrow: 1, minWidth: 0, maxWidth: "280px" },
  level: {
    minWidth: "3ch",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

interface DeviceRowProps {
  device: AudioDevice;
  variant: DeviceRowVariant;
  onSwitch: (device: AudioDevice) => void;
  /** True while *this* device is being switched to. */
  busy?: boolean;
  /** Omit to hide the star (the flyout has no favorite editing). */
  favorite?: boolean;
  onToggleFavorite?: (device: AudioDevice) => void;
  /** Omit both to hide the volume row entirely. */
  volume?: DeviceVolume;
  onVolumeChange?: (device: AudioDevice, level: number) => void;
  onToggleMute?: (device: AudioDevice) => void;
}

export default function DeviceRow({
  device,
  variant,
  onSwitch,
  busy = false,
  favorite,
  onToggleFavorite,
  volume,
  onVolumeChange,
  onToggleMute,
}: DeviceRowProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const full = variant === "full";
  const Icon = device.direction === "output" ? Speaker2Regular : MicRegular;

  // The volume worth reaching for is almost always the one on the device
  // actually in use, so that row keeps its slider open; the rest expand on
  // demand, which keeps the list compact.
  const [expanded, setExpanded] = useState(false);
  const volumeAvailable = volume !== undefined && onVolumeChange !== undefined;
  const showVolume = volumeAvailable && (device.isDefault || expanded);
  const percent = Math.round((volume?.level ?? 0) * 100);
  const MuteIcon = volume?.muted
    ? SpeakerMuteRegular
    : percent === 0
      ? Speaker0Regular
      : Speaker2Regular;

  return (
    <div
      className={mergeClasses(
        styles.frame,
        full && styles.frameFull,
        device.isDefault &&
          (full ? styles.frameFullActive : styles.frameCompactActive),
      )}
    >
      <div className={mergeClasses(styles.header, full && styles.headerFull)}>
        <button
          type="button"
          disabled={busy}
          // Communicates "this is the current default" to assistive tech, which
          // previously only had the colour and the badge to go on.
          aria-current={device.isDefault ? "true" : undefined}
          className={mergeClasses(
            styles.button,
            full ? styles.buttonFull : styles.buttonCompact,
          )}
          onClick={() => onSwitch(device)}
        >
          <Icon
            className={mergeClasses(
              styles.icon,
              full ? styles.iconFull : styles.iconCompact,
            )}
          />
          {full ? (
            <Body1 className={styles.name}>{device.name}</Body1>
          ) : (
            <span className={mergeClasses(styles.name, styles.nameCompact)}>
              {device.name}
            </span>
          )}
          {!full && device.isDefault && (
            <CheckmarkCircleFilled className={styles.check} />
          )}
        </button>

        {full &&
          (busy ? (
            <Spinner size="tiny" />
          ) : device.isDefault ? (
            // A discreet check rather than a labelled badge: the brand border
            // and background already say "active", but colour alone does not
            // carry for everyone.
            <CheckmarkCircleFilled
              className={mergeClasses(styles.check, styles.checkFull)}
              aria-label={t("common.active")}
            />
          ) : null)}

        {volumeAvailable && !device.isDefault && (
          <Tooltip
            content={expanded ? t("volume.hide") : t("volume.show")}
            relationship="label"
          >
            <button
              type="button"
              aria-expanded={expanded}
              className={styles.chevron}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
            </button>
          </Tooltip>
        )}

        {full && favorite !== undefined && onToggleFavorite && (
          <Tooltip
            content={
              favorite ? t("devices.removeFromCycle") : t("devices.addToCycle")
            }
            relationship="label"
          >
            <button
              type="button"
              aria-pressed={favorite}
              className={mergeClasses(styles.star, favorite && styles.starActive)}
              onClick={() => onToggleFavorite(device)}
            >
              {favorite ? <StarFilled /> : <StarRegular />}
            </button>
          </Tooltip>
        )}
      </div>

      {showVolume && volume && onVolumeChange && (
        <div
          className={mergeClasses(
            styles.volumeRow,
            !full && styles.volumeRowCompact,
          )}
        >
          {onToggleMute && (
            <Tooltip
              content={volume.muted ? t("volume.unmute") : t("volume.mute")}
              relationship="label"
            >
              <button
                type="button"
                aria-pressed={volume.muted}
                className={mergeClasses(
                  styles.muteButton,
                  volume.muted && styles.muteButtonActive,
                )}
                onClick={() => onToggleMute(device)}
              >
                <MuteIcon />
              </button>
            </Tooltip>
          )}
          <Slider
            className={styles.slider}
            size="small"
            min={0}
            max={100}
            value={percent}
            aria-label={t("volume.label", { name: device.name })}
            onChange={(_, data) => onVolumeChange(device, data.value / 100)}
          />
          <span className={styles.level}>{percent}</span>
        </div>
      )}
    </div>
  );
}
