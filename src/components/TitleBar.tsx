import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { ReactNode } from "react";

/**
 * Windows draws its own caption buttons with these glyphs from Segoe Fluent
 * Icons (Windows 11) or Segoe MDL2 Assets (Windows 10). Using the same ones is
 * what makes a custom title bar read as native rather than as an approximation.
 */
const GLYPH = {
  minimize: "",
  maximize: "",
  restore: "",
  close: "",
} as const;

/**
 * Windows 11 captions are 32px, but this one carries the app's own controls, so
 * it is a little taller to give them room — the way VS Code and Discord do it.
 * The caption buttons keep their native 46px width.
 */
const BAR_HEIGHT = 40;
const BUTTON_WIDTH = 46;

const useStyles = makeStyles({
  bar: {
    display: "flex",
    alignItems: "center",
    height: `${BAR_HEIGHT}px`,
    flexShrink: 0,
    backgroundColor: tokens.colorNeutralBackground2,
    userSelect: "none",
  },
  drag: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexGrow: 1,
    minWidth: 0,
    height: "100%",
    paddingLeft: tokens.spacingHorizontalM,
    // WebView2 backs a drag region with a real window that floats above the
    // page. Declaring it here as well as via `data-tauri-drag-region` keeps
    // dragging working; every interactive control then has to opt *out*.
    WebkitAppRegion: "drag",
  },
  // The controls sit inside the caption but must not drag the window, so they
  // stay outside the drag region rather than opting out of it.
  slot: {
    display: "flex",
    alignItems: "center",
    height: "100%",
    paddingRight: tokens.spacingHorizontalM,
    flexShrink: 0,
    // Outside the drag region, and explicitly so: the drag window would
    // otherwise swallow every click meant for these controls.
    WebkitAppRegion: "no-drag",
  },
  icon: {
    width: "16px",
    height: "16px",
    flexShrink: 0,
    // Pointer events off so the icon does not interrupt the drag region.
    pointerEvents: "none",
  },
  title: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  },
  buttons: {
    display: "flex",
    height: "100%",
    flexShrink: 0,
    WebkitAppRegion: "no-drag",
  },
  button: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: `${BUTTON_WIDTH}px`,
    height: "100%",
    border: "none",
    padding: 0,
    background: "none",
    cursor: "default",
    color: tokens.colorNeutralForeground1,
    // The caption glyph fonts; the fallback keeps Windows 10 working.
    fontFamily: '"Segoe Fluent Icons", "Segoe MDL2 Assets", sans-serif',
    fontSize: "10px",
    lineHeight: 1,
    ":hover": { backgroundColor: tokens.colorNeutralBackground3Hover },
    ":active": { backgroundColor: tokens.colorNeutralBackground3Pressed },
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "-2px",
    },
  },
  close: {
    // The one caption button Windows colours: #c42b1c on hover, everywhere.
    ":hover": { backgroundColor: "#c42b1c", color: "#ffffff" },
    ":active": { backgroundColor: "#b2271a", color: "#ffffff" },
  },
});

/**
 * The window's caption, drawn by the app.
 *
 * The window is created without decorations, so this provides the title, the
 * drag region and the caption buttons. `data-tauri-drag-region` gives us
 * dragging and double-click-to-maximize for free.
 *
 * `children` are the app's own controls, placed between the title and the
 * caption buttons. They are deliberately outside the drag region: anything
 * inside it would drag the window instead of taking the click.
 *
 * One thing an app-drawn bar cannot offer is the Windows 11 snap-layouts
 * flyout: it needs the top-level window to answer `WM_NCHITTEST` with
 * `HTMAXBUTTON`, and the webview's child windows cover the whole client area,
 * so the hit test never reaches it — measured, not assumed. Settings has a
 * "native" option for anyone who would rather have that back.
 */
export default function TitleBar({ children }: { children?: ReactNode }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);

  const appWindow = getCurrentWindow();

  useEffect(() => {
    let disposed = false;
    let off: (() => void) | undefined;

    void appWindow
      .isMaximized()
      .then((value) => {
        if (!disposed) setMaximized(value);
      })
      .catch((e) => console.error("could not read the window state", e));
    void appWindow
      .onResized(() => {
        void appWindow.isMaximized().then((value) => {
          if (!disposed) setMaximized(value);
        });
      })
      .then((unlisten) => {
        if (disposed) unlisten();
        else off = unlisten;
      });

    return () => {
      disposed = true;
      off?.();
    };
  }, [appWindow]);

  return (
    <div className={styles.bar}>
      <div className={styles.drag} data-tauri-drag-region>
        <img src="/favicon.png" alt="" className={styles.icon} />
        <span className={styles.title}>{t("app.name")}</span>
      </div>
      {children && <div className={styles.slot}>{children}</div>}
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.button}
          aria-label={t("titlebar.minimize")}
          onClick={() =>
            void appWindow.minimize().catch((e) =>
              console.error("could not minimize the window", e),
            )
          }
        >
          {GLYPH.minimize}
        </button>
        <button
          type="button"
          className={styles.button}
          aria-label={maximized ? t("titlebar.restore") : t("titlebar.maximize")}
          onClick={() =>
            void appWindow.toggleMaximize().catch((e) =>
              console.error("could not maximize the window", e),
            )
          }
        >
          {maximized ? GLYPH.restore : GLYPH.maximize}
        </button>
        <button
          type="button"
          className={mergeClasses(styles.button, styles.close)}
          aria-label={t("titlebar.close")}
          onClick={() =>
            void appWindow.close().catch((e) =>
              console.error("could not close the window", e),
            )
          }
        >
          {GLYPH.close}
        </button>
      </div>
    </div>
  );
}
