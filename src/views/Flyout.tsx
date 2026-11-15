import { useEffect, useRef } from "react";
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
import KeyChip from "../components/KeyChip";
import { useDevices } from "../hooks/useDevices";
import { useFavorites } from "../hooks/useFavorites";
import { useFlyoutSizing } from "../hooks/useFlyoutSizing";
import { useHotkeyHints } from "../hooks/useHotkeyHints";
import { useMute } from "../hooks/useMute";
import { useVolume } from "../hooks/useVolume";
import { useTauriEvent } from "../hooks/useTauriEvent";
import { useVolumeOsd } from "../hooks/useVolumeOsd";
import { closeFlyout, type AudioDevice } from "../lib/tauri";
import { acrylicTint } from "../theme/acrylicTint";

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
  // Acrylic: the window is the card. The system paints backdrop, corners and
  // shadow, so the page keeps none of its own.
  cardFlush: {
    margin: 0,
    backgroundColor: acrylicTint(tokens.colorNeutralBackground1),
    boxShadow: "none",
    borderRadius: 0,
  },
  groupLabel: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
  },
  groupTitle: { fontWeight: tokens.fontWeightSemibold, flexGrow: 1 },
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
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "-2px",
    },
  },
  muteActive: { color: tokens.colorPaletteRedForeground1 },
  muteIcon: { fontSize: "18px", flexShrink: 0 },
  muteLabel: { flexGrow: 1, fontSize: tokens.fontSizeBase300 },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    color: tokens.colorNeutralForeground3,
  },
  hint: {
    display: "inline-flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
});

/**
 * Compact quick-switch list shown in the tray flyout window. Lists favorite
 * output then input devices; picking one switches and closes the flyout.
 *
 * Keyboard-first, like the Windows command surfaces: Up/Down move between the
 * rows and the mute button, Enter picks, Esc closes. Nothing is focused on open
 * (a ring would show on a mouse click), so the first arrow key takes focus.
 */
export default function Flyout({ flush }: { flush: boolean }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { devices, loading, error, switchTo, switching } = useDevices();
  const { favorites } = useFavorites();
  const { muted, toggle: toggleMute } = useMute();
  const { volumes, setLevel, toggleMute: toggleDeviceMute } = useVolume(devices);
  const { osd, reload: reloadOsd } = useVolumeOsd();
  const hotkeys = useHotkeyHints();
  // The window lives suspended between opens and never sees a setting changed
  // in the main window; the backend announces every open.
  useTauriEvent("flyout-opened", reloadOsd, [reloadOsd]);
  const cardRef = useRef<HTMLDivElement>(null);

  // Unlike the main list, the flyout hides unavailable devices outright: it is
  // a quick-switch menu, and a row you cannot pick is only in the way.
  const outputs = devices.filter(
    (d) =>
      d.direction === "output" &&
      d.state === "active" &&
      favorites.output.includes(d.id),
  );
  const inputs = devices.filter(
    (d) =>
      d.direction === "input" &&
      d.state === "active" &&
      favorites.input.includes(d.id),
  );
  const isEmpty = outputs.length === 0 && inputs.length === 0;

  useFlyoutSizing(cardRef, flush);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void closeFlyout();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      // A slider uses the arrows for itself; Tab is the way out of it. Fluent's
      // renders a native range input, which carries no `role` attribute.
      const target = event.target;
      if (
        (target instanceof HTMLInputElement && target.type === "range") ||
        (target instanceof HTMLElement && target.getAttribute("role") === "slider")
      ) {
        return;
      }
      const items = Array.from(
        cardRef.current?.querySelectorAll<HTMLElement>("[data-nav]:not(:disabled)") ??
          [],
      );
      if (items.length === 0) return;
      event.preventDefault();
      const at = items.indexOf(document.activeElement as HTMLElement);
      const last = items.length - 1;
      let next: number;
      if (event.key === "Home") next = 0;
      else if (event.key === "End") next = last;
      else if (event.key === "ArrowDown") next = at < 0 ? 0 : Math.min(at + 1, last);
      else next = at < 0 ? last : Math.max(at - 1, 0);
      items[next].focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const pick = async (device: AudioDevice) => {
    await switchTo(device, true);
    await closeFlyout();
  };

  const renderGroup = (
    label: string,
    Icon: typeof Speaker2Regular,
    list: AudioDevice[],
    hotkey: string,
  ) =>
    list.length > 0 && (
      <>
        <div className={styles.groupLabel}>
          <Icon fontSize={14} />
          <Caption1 className={styles.groupTitle}>{label}</Caption1>
          {hotkey && <KeyChip>{hotkey}</KeyChip>}
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
    <div
      ref={cardRef}
      className={mergeClasses(styles.card, flush && styles.cardFlush)}
    >
      {loading ? (
        <div className={styles.empty}>
          <Spinner size="tiny" />
        </div>
      ) : (
        <>
          {/* The flyout used to discard `error` entirely, so a failure here
              looked like "no favorites". */}
          {error && (
            <MessageBar intent="error" layout="multiline">
              <MessageBarBody>{t(`errors.${error.kind}`)}</MessageBarBody>
            </MessageBar>
          )}
          {isEmpty && !error ? (
            <Caption1 className={styles.empty}>{t("flyout.empty")}</Caption1>
          ) : (
            <>
              {renderGroup(
                t("common.output"),
                Speaker2Regular,
                outputs,
                hotkeys.cycleOutput,
              )}
              {renderGroup(
                t("common.input"),
                MicRegular,
                inputs,
                hotkeys.cycleInput,
              )}
            </>
          )}
          <div className={styles.divider} />
          <button
            type="button"
            data-nav=""
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
            {hotkeys.toggleMute && <KeyChip>{hotkeys.toggleMute}</KeyChip>}
          </button>
          <div className={styles.footer}>
            <Caption1 className={styles.hint}>
              <KeyChip>↑↓</KeyChip>
              {t("flyout.navigate")}
            </Caption1>
            <Caption1 className={styles.hint}>
              <KeyChip>↵</KeyChip>
              {t("flyout.select")}
            </Caption1>
            <Caption1 className={styles.hint}>
              <KeyChip>Esc</KeyChip>
              {t("flyout.close")}
            </Caption1>
          </div>
        </>
      )}
    </div>
  );
}
