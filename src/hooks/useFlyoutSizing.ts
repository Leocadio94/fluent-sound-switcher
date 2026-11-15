import { useLayoutEffect, type RefObject } from "react";
import { listen } from "@tauri-apps/api/event";

import { setFlyoutSize } from "../lib/tauri";

/** Room the solid card keeps around itself for its CSS shadow. */
const SHADOW_ALLOWANCE = 16;
/** Time the backend gets to apply a size before the result is checked. */
const SETTLE_MS = 150;
const MAX_EXTRA = 48;
const MAX_ATTEMPTS = 3;

/**
 * Keeps the flyout window exactly as tall as its card.
 *
 * With Acrylic the window *is* the card, so there is no slack: if the window
 * comes out even a few pixels short the page scrolls under the pointer and the
 * rows jump on hover. An undecorated window with a system shadow carries hidden
 * frame offsets, so the size that was asked for is not always the size obtained.
 * After every size request the viewport is measured, and any shortfall is asked
 * for on top, up to `MAX_EXTRA`.
 *
 * The shortfall belongs to one open on one monitor: the window can land on
 * another screen at another DPI, and it lives suspended in between, so it is
 * measured again on every open (`flyout-view`).
 *
 * @see docs/janela-material.md
 */
export function useFlyoutSizing(
  ref: RefObject<HTMLElement | null>,
  flush: boolean,
  menu = false,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const allowance = flush ? 0 : SHADOW_ALLOWANCE;
    let extra = 0;
    let timer: number | undefined;

    const wanted = () => el.offsetHeight + allowance;

    const verify = (attempt: number) => {
      // A suspended or hidden webview reports a stale or empty viewport.
      const viewport = document.documentElement.clientHeight;
      if (document.visibilityState !== "visible" || viewport === 0) return;
      const missing = Math.ceil(wanted() - viewport);
      if (missing <= 0 || extra >= MAX_EXTRA || attempt >= MAX_ATTEMPTS) return;
      extra = Math.min(MAX_EXTRA, extra + missing);
      void setFlyoutSize(wanted() + extra, menu);
      timer = window.setTimeout(() => verify(attempt + 1), SETTLE_MS);
    };

    const report = () => {
      void setFlyoutSize(wanted() + extra, menu);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => verify(1), SETTLE_MS);
    };

    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);

    const reopened = listen("flyout-view", () => {
      extra = 0;
      report();
    });

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      void reopened.then((unlisten) => unlisten());
    };
  }, [ref, flush, menu]);
}
