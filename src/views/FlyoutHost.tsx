import { useState } from "react";

import { useTauriEvent } from "../hooks/useTauriEvent";
import type { FlyoutView, TrayMenuEntry } from "../lib/tauri";
import Flyout from "./Flyout";
import TrayMenu from "./TrayMenu";

interface OpenMenu {
  /** The event id, so every open remounts the menu with no stale focus. */
  opened: number;
  items: TrayMenuEntry[];
}

/**
 * The flyout window serves two faces: the device quick-switch list and the
 * tray's right-click menu. The backend says which one on every open.
 */
export default function FlyoutHost() {
  const [menu, setMenu] = useState<OpenMenu | null>(null);

  useTauriEvent<FlyoutView>("flyout-view", ({ id, payload }) =>
    setMenu(
      payload.kind === "menu" ? { opened: id, items: payload.items } : null,
    ),
  );

  return menu ? <TrayMenu key={menu.opened} items={menu.items} /> : <Flyout />;
}
