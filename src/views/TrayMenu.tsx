import { useEffect, useRef } from "react";
import {
  MenuDivider,
  MenuItem,
  MenuList,
  makeStyles,
  mergeClasses,
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

import KeyChip from "../components/KeyChip";
import { useFlyoutSizing } from "../hooks/useFlyoutSizing";
import { useHotkeyHints } from "../hooks/useHotkeyHints";
import { closeFlyout, trayMenuAction, type TrayMenuEntry } from "../lib/tauri";
import { acrylicTint } from "../theme/acrylicTint";

const useStyles = makeStyles({
  card: {
    margin: "8px",
    padding: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow16,
  },
  // Acrylic: the window is the card; see Flyout.tsx.
  cardFlush: {
    margin: 0,
    backgroundColor: acrylicTint(tokens.colorNeutralBackground1),
    boxShadow: "none",
    border: "none",
    borderRadius: 0,
  },
  // Over Acrylic the entries carry no fill of their own, like the device list;
  // only the hover and keyboard focus draw one.
  itemFlush: {
    backgroundColor: "transparent",
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
    ":focus": { backgroundColor: tokens.colorSubtleBackgroundHover },
    ":active": { backgroundColor: tokens.colorSubtleBackgroundPressed },
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
export default function TrayMenu({
  items,
  flush,
}: {
  items: TrayMenuEntry[];
  flush: boolean;
}) {
  const styles = useStyles();
  const cardRef = useRef<HTMLDivElement>(null);
  const hotkeys = useHotkeyHints();

  useFlyoutSizing(cardRef, flush, true);

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
    <div
      ref={cardRef}
      className={mergeClasses(styles.card, flush && styles.cardFlush)}
    >
      <MenuList>
        {items.map((entry, index) => {
          if (entry.kind === "separator") return <MenuDivider key={index} />;
          const Icon = ICONS[entry.id];
          const hotkey = entry.id === "toggle_mute" ? hotkeys.toggleMute : "";
          return (
            <MenuItem
              key={entry.id}
              className={flush ? styles.itemFlush : undefined}
              icon={Icon ? <Icon /> : undefined}
              secondaryContent={hotkey ? <KeyChip>{hotkey}</KeyChip> : undefined}
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
