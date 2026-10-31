import { useEffect, useLayoutEffect, useRef } from "react";
import {
  MenuDivider,
  MenuItem,
  MenuList,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowExitRegular,
  ArrowSyncRegular,
  MicRegular,
  OpenRegular,
  SettingsRegular,
  Speaker2Regular,
} from "@fluentui/react-icons";
import type { ComponentType } from "react";

import {
  closeFlyout,
  setFlyoutSize,
  trayMenuAction,
  type TrayMenuEntry,
} from "../lib/tauri";

const useStyles = makeStyles({
  card: {
    margin: "8px",
    padding: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow16,
  },
});

const ICONS: Record<string, ComponentType> = {
  show: OpenRegular,
  settings: SettingsRegular,
  sound_panel: Speaker2Regular,
  toggle_mute: MicRegular,
  check_updates: ArrowSyncRegular,
  quit: ArrowExitRegular,
};

/** The tray's right-click menu, drawn by the flyout window so it can sit above fullscreen games. */
export default function TrayMenu({ items }: { items: TrayMenuEntry[] }) {
  const styles = useStyles();
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const report = () => void setFlyoutSize(el.offsetHeight + 16);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Arrow keys only move between entries once one has focus, and opening with
  // the mouse leaves none focused (focusing one would draw a ring on a click).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void closeFlyout();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const entries = Array.from(
        cardRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      );
      if (entries.length === 0 || entries.includes(document.activeElement as HTMLElement)) {
        return;
      }
      event.preventDefault();
      entries[event.key === "ArrowDown" ? 0 : entries.length - 1].focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div ref={cardRef} className={styles.card}>
      <MenuList>
        {items.map((entry, index) => {
          if (entry.kind === "separator") return <MenuDivider key={index} />;
          const Icon = ICONS[entry.id];
          return (
            <MenuItem
              key={entry.id}
              icon={Icon ? <Icon /> : undefined}
              onClick={() => void trayMenuAction(entry.id)}
            >
              {entry.label}
            </MenuItem>
          );
        })}
      </MenuList>
    </div>
  );
}
