import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Caption1,
  MessageBar,
  MessageBarBody,
  Spinner,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  MicProhibitedFilled,
  MicRegular,
  Speaker2Regular,
} from "@fluentui/react-icons";

import DeviceRow from "../components/DeviceRow";
import { useDevices } from "../hooks/useDevices";
import { useFavorites } from "../hooks/useFavorites";
import { useMute } from "../hooks/useMute";
import { useVolume } from "../hooks/useVolume";
import { useVolumeOsd } from "../hooks/useVolumeOsd";
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
  empty: {
    padding: tokens.spacingVerticalM,
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
  },
  divider: {
    height: tokens.strokeWidthThin,
    backgroundColor: tokens.colorNeutralStroke2,
    margin: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
  },
  muteButton: {
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
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
    },
  },
  muteActive: { color: tokens.colorPaletteRedForeground1 },
  muteIcon: { fontSize: "18px", flexShrink: 0 },
  muteLabel: { flexGrow: 1, fontSize: tokens.fontSizeBase300 },
});

/**
 * Compact quick-switch list shown in the tray flyout window. Lists favorite
 * output then input devices; picking one switches and closes the flyout.
 */
export default function Flyout() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { devices, loading, error, switchTo, switching } = useDevices();
  const { favorites } = useFavorites();
  const { muted, toggle: toggleMute } = useMute();
  const { volumes, setLevel, toggleMute: toggleDeviceMute } = useVolume(devices);
  const { osd } = useVolumeOsd();
  const cardRef = useRef<HTMLDivElement>(null);

  const outputs = devices.filter(
    (d) => d.direction === "output" && favorites.output.includes(d.id),
  );
  const inputs = devices.filter(
    (d) => d.direction === "input" && favorites.input.includes(d.id),
  );
  const isEmpty = outputs.length === 0 && inputs.length === 0;

  // Keep the window sized to the content. The ResizeObserver covers content
  // changes on its own; the effect only needs to re-run when the element is
  // replaced, which it never is.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const report = () => void setFlyoutSize(el.offsetHeight + 16);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pick = async (device: AudioDevice) => {
    await switchTo(device, true);
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
          <DeviceRow
            key={device.id}
            device={device}
            variant="compact"
            busy={switching === device.id}
            onSwitch={(d) => void pick(d)}
            volume={osd.slidersInFlyout ? volumes[device.id] : undefined}
            onVolumeChange={osd.slidersInFlyout ? setLevel : undefined}
            onToggleMute={osd.slidersInFlyout ? toggleDeviceMute : undefined}
          />
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
          {/* The flyout used to discard `error` entirely, so a failure here
              looked like "no favorites". */}
          {error && (
            <MessageBar intent="error">
              <MessageBarBody>{t(`errors.${error.kind}`)}</MessageBarBody>
            </MessageBar>
          )}
          {isEmpty && !error ? (
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
            aria-pressed={muted}
            className={mergeClasses(styles.muteButton, muted && styles.muteActive)}
            onClick={() => toggleMute()}
          >
            {muted ? (
              <MicProhibitedFilled className={styles.muteIcon} />
            ) : (
              <MicRegular className={styles.muteIcon} />
            )}
            <span className={styles.muteLabel}>
              {muted ? t("flyout.unmute") : t("flyout.mute")}
            </span>
          </button>
        </>
      )}
    </div>
  );
}
