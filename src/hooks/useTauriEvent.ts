import { useEffect } from "react";
import { listen, type EventCallback } from "@tauri-apps/api/event";

/**
 * Subscribes to a backend event for the lifetime of the component.
 *
 * `listen` resolves to the unsubscribe function, so every call site repeated
 * the same `void unlisten.then((off) => off())` cleanup — seven times across
 * the app, each an opportunity to forget it.
 *
 * `handler` is read through a ref-free dependency array on purpose: pass a
 * stable callback (`useCallback`) when it closes over changing state.
 */
export function useTauriEvent<T>(
  event: string,
  handler: EventCallback<T>,
  deps: unknown[] = [],
) {
  useEffect(() => {
    // `listen` is async, so the component can unmount before it resolves;
    // guard against attaching a listener nobody will ever detach.
    let disposed = false;
    let off: (() => void) | undefined;

    void listen<T>(event, handler).then((unlisten) => {
      if (disposed) {
        unlisten();
        return;
      }
      off = unlisten;
    });

    return () => {
      disposed = true;
      off?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
