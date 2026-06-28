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
 * Requires at least one modifier plus a letter, digit or function key so the
 * binding can't collide with plain typing.
 */
function toAccelerator(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push("Super");

  let key: string | null = null;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)) key = e.code;

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
