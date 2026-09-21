import { useTranslation } from "react-i18next";
import { Switch } from "@fluentui/react-components";

import type { GamepadHotkeys } from "../../lib/config";
import SettingRow from "./SettingRow";
import SettingsNotice from "./SettingsNotice";
import type { TranslationKey } from "./shared";

/** Fixed chord→action mapping; the backend implements exactly this. */
const MAPPING: { labelKey: TranslationKey; buttonKey: TranslationKey }[] = [
  { labelKey: "hotkeys.cycleOutput", buttonKey: "hotkeys.gamepadButtons.a" },
  { labelKey: "hotkeys.cycleInput", buttonKey: "hotkeys.gamepadButtons.b" },
  { labelKey: "hotkeys.toggleMute", buttonKey: "hotkeys.gamepadButtons.x" },
  { labelKey: "hotkeys.toggleOutputMute", buttonKey: "hotkeys.gamepadButtons.y" },
  { labelKey: "hotkeys.volumeUp", buttonKey: "hotkeys.gamepadButtons.dpadUp" },
  { labelKey: "hotkeys.volumeDown", buttonKey: "hotkeys.gamepadButtons.dpadDown" },
];

interface GamepadTabProps {
  gamepad: GamepadHotkeys;
  onChange: (enabled: boolean) => void;
}

export default function GamepadTab({ gamepad, onChange }: GamepadTabProps) {
  const { t } = useTranslation();

  return (
    <>
      <SettingRow label={t("hotkeys.gamepadEnable")}>
        <Switch
          checked={gamepad.enabled}
          onChange={(_, d) => onChange(d.checked)}
        />
      </SettingRow>
      <SettingsNotice>{t("hotkeys.gamepadHint")}</SettingsNotice>
      <SettingsNotice>{t("hotkeys.gamepadNoHome")}</SettingsNotice>
      {MAPPING.map(({ labelKey, buttonKey }) => (
        <SettingRow key={labelKey} label={t(labelKey)}>
          {t("hotkeys.gamepadChord", { button: t(buttonKey) })}
        </SettingRow>
      ))}
    </>
  );
}
