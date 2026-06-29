import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Caption1,
  Spinner,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  CheckmarkCircleFilled,
  MicProhibitedFilled,
  MicRegular,
  Speaker2Regular,
} from "@fluentui/react-icons";

import { useDevices } from "../hooks/useDevices";
import { useFavorites } from "../hooks/useFavorites";
import { useMute } from "../hooks/useMute";
import { closeFlyout, setFlyoutSize, type AudioDevice } from "../lib/tauri";

const useStyles = makeStyles({
  card: {
    margin: "8px",
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  groupLabel: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    width: "100%",
    boxSizing: "border-box",
    padding: `${tokens.spacingVerticalSNudge} ${tokens.spacingHorizontalS}`,
    border: "none",
    background: "none",
    color: tokens.colorNeutralForeground1,
    font: "inherit",
    textAlign: "left",
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  rowActive: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  icon: { fontSize: "18px", color: tokens.colorNeutralForeground3, flexShrink: 0 },
  name: {
    flexGrow: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: tokens.fontSizeBase300,
  },
  check: { color: tokens.colorBrandForeground1, flexShrink: 0 },
  empty: { padding: tokens.spacingVerticalM, textAlign: "center", color: tokens.colorNeutralForeground3 },
  divider: {
    height: tokens.strokeWidthThin,
    backgroundColor: tokens.colorNeutralStroke2,
    margin: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
  },
  muteRow: {
    color: tokens.colorNeutralForeground1,
  },
  muteActive: {
    color: tokens.colorPaletteRedForeground1,
  },
});

/**
 * Compact quick-switch list shown in the tray flyout window. Lists favorite
 * output then input devices; picking one switches and closes the flyout.
 */
export default function Flyout() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { devices, loading, switchTo } = useDevices();
  const { favorites } = useFavorites();
  const { muted, toggle: toggleMute } = useMute();
  const cardRef = useRef<HTMLDivElement>(null);

  const outputs = devices.filter(
    (d) => d.direction === "output" && favorites.output.includes(d.id),
  );
  const inputs = devices.filter(
    (d) => d.direction === "input" && favorites.input.includes(d.id),
  );
  const isEmpty = outputs.length === 0 && inputs.length === 0;

  // Keep the window sized to the content.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const report = () => void setFlyoutSize(el.offsetHeight + 16);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, outputs.length, inputs.length, isEmpty]);

  const pick = async (device: AudioDevice) => {
    await switchTo(device);
    await closeFlyout();
  };

  const renderGroup = (
    label: string,
    Icon: typeof Speaker2Regular,
    list: AudioDevice[],
  ) =>
    list.length > 0 && (
      <>
        <div className={styles.groupLabel}>
          <Icon fontSize={14} />
          <Caption1>{label}</Caption1>
        </div>
        {list.map((device) => (
          <button
            key={device.id}
            type="button"
            className={mergeClasses(
              styles.row,
              device.isDefault && styles.rowActive,
            )}
            onClick={() => void pick(device)}
          >
            <Icon className={styles.icon} />
            <span className={styles.name}>{device.name}</span>
            {device.isDefault && <CheckmarkCircleFilled className={styles.check} />}
          </button>
        ))}
      </>
    );

  return (
    <div ref={cardRef} className={styles.card}>
      {loading ? (
        <div className={styles.empty}>
          <Spinner size="tiny" />
        </div>
      ) : (
        <>
          {isEmpty ? (
            <Caption1 className={styles.empty}>{t("flyout.empty")}</Caption1>
          ) : (
            <>
              {renderGroup(t("common.output"), Speaker2Regular, outputs)}
              {renderGroup(t("common.input"), MicRegular, inputs)}
            </>
          )}
          <div className={styles.divider} />
          <button
            type="button"
            className={mergeClasses(styles.row, muted && styles.muteActive)}
            onClick={() => toggleMute()}
          >
            {muted ? (
              <MicProhibitedFilled className={styles.icon} />
            ) : (
              <MicRegular className={styles.icon} />
            )}
            <span className={styles.name}>
              {muted ? t("flyout.unmute") : t("flyout.mute")}
            </span>
          </button>
        </>
      )}
    </div>
  );
}
