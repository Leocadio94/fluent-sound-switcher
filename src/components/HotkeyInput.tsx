import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, makeStyles, tokens } from "@fluentui/react-components";
import { KeyboardRegular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  button: {
    minWidth: "160px",
    fontFamily: tokens.fontFamilyMonospace,
  },
  recording: {
    color: tokens.colorBrandForeground1,
  },
});

/**
 * Translates a keydown into a Tauri accelerator string (e.g. "Ctrl+Alt+F11").
 * Requires at least one modifier plus a letter, digit, function or navigation
 * key, so the binding can't collide with plain typing.
 *
 * Media keys are the one exception: they are accepted bare, since that is how
 * people expect to bind them, and they cannot be typed by accident. Binding one
 * takes it away from Windows for as long as the app runs, which is why the
 * volume actions ship unbound and the UI warns about it.
 *
 * Exported for testing.
 */
export function toAccelerator(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push("Super");

  // Tauri's accelerator names for the media keys.
  const media: Record<string, string> = {
    AudioVolumeUp: "VolumeUp",
    AudioVolumeDown: "VolumeDown",
    AudioVolumeMute: "VolumeMute",
    MediaPlayPause: "MediaPlayPause",
    MediaStop: "MediaStop",
    MediaTrackNext: "MediaTrackNext",
    MediaTrackPrevious: "MediaTrackPrevious",
  };
  if (media[e.code]) {
    return [...mods, media[e.code]].join("+");
  }

  const navigation: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Insert: "Insert",
    Delete: "Delete",
  };

  let key: string | null = null;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)) key = e.code;
  else if (navigation[e.code]) key = navigation[e.code];

  if (!key || mods.length === 0) return null;
  return [...mods, key].join("+");
}

interface HotkeyInputProps {
  value: string;
  onChange: (accelerator: string) => void;
}

export default function HotkeyInput({ value, onChange }: HotkeyInputProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);

  const stop = useCallback(() => setRecording(false), []);

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        stop();
        return;
      }
      const accelerator = toAccelerator(e);
      if (accelerator) {
        onChange(accelerator);
        stop();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, onChange, stop]);

  return (
    <Button
      className={styles.button}
      icon={<KeyboardRegular />}
      appearance={recording ? "primary" : "outline"}
      onClick={() => setRecording((r) => !r)}
      onBlur={stop}
    >
      {recording ? t("hotkeys.press") : value || t("hotkeys.none")}
    </Button>
  );
}
