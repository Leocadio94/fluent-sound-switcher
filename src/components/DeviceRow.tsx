import { useTranslation } from "react-i18next";
import {
  Badge,
  Body1,
  Spinner,
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

import type { AudioDevice } from "../lib/tauri";

/**
 * `full` is the main window's list (bordered card, active badge, favorite
 * star); `compact` is the tray flyout (dense row, checkmark only). They used to
 * be two hand-rolled copies of the same markup and near-identical `makeStyles`
 * blocks in `DeviceList` and `Flyout`.
 */
export type DeviceRowVariant = "full" | "compact";

const useStyles = makeStyles({
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusLarge,
  },
  rowFull: {
    paddingRight: tokens.spacingHorizontalS,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  rowFullActive: {
    border: `${tokens.strokeWidthThin} solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  rowCompactActive: {
    backgroundColor: tokens.colorBrandBackground2,
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
}

export default function DeviceRow({
  device,
  variant,
  onSwitch,
  busy = false,
  favorite,
  onToggleFavorite,
}: DeviceRowProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const full = variant === "full";
  const Icon = device.direction === "output" ? Speaker2Regular : MicRegular;

  return (
    <div
      className={mergeClasses(
        styles.row,
        full && styles.rowFull,
        device.isDefault && (full ? styles.rowFullActive : styles.rowCompactActive),
      )}
    >
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
          <Badge appearance="tint" color="brand" icon={<CheckmarkCircleFilled />}>
            {t("common.active")}
          </Badge>
        ) : null)}

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
  );
}
