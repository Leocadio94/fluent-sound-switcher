import { useState } from "react";

import { useTauriEvent } from "../hooks/useTauriEvent";
import type { FlyoutView, TrayMenuEntry } from "../lib/tauri";
import { useLeaving, useWindowMotion } from "../theme/motion";
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
  const [flush, setFlush] = useState(false);

  useTauriEvent<FlyoutView>("flyout-view", ({ id, payload }) => {
    setFlush(payload.flush);
    setMenu(
      payload.kind === "menu" ? { opened: id, items: payload.items } : null,
    );
  });

  const leaving = useLeaving("flyout-leave", "flyout-view");
  const motion = useWindowMotion(flush ? "none" : "rise", leaving);

  return (
    <div className={motion}>
      {menu ? (
        <TrayMenu key={menu.opened} items={menu.items} flush={flush} />
      ) : (
        <Flyout flush={flush} />
      )}
    </div>
  );
}
