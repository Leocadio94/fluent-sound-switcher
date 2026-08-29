import { useTranslation } from "react-i18next";

import HotkeyInput from "../../components/HotkeyInput";
import type { Hotkeys } from "../../lib/config";
import type { HotkeyFailure } from "../../lib/tauri";
import SettingRow from "./SettingRow";
import SettingsNotice from "./SettingsNotice";
import type { TranslationKey } from "./shared";

const ACTIONS: { key: keyof Hotkeys; labelKey: TranslationKey }[] = [
  { key: "cycleOutput", labelKey: "hotkeys.cycleOutput" },
  { key: "cycleInput", labelKey: "hotkeys.cycleInput" },
  { key: "toggleMute", labelKey: "hotkeys.toggleMute" },
  { key: "toggleOutputMute", labelKey: "hotkeys.toggleOutputMute" },
  { key: "volumeUp", labelKey: "hotkeys.volumeUp" },
  { key: "volumeDown", labelKey: "hotkeys.volumeDown" },
];

interface HotkeysTabProps {
  hotkeys: Hotkeys;
  onChange: (action: keyof Hotkeys, accelerator: string) => void;
  failures: HotkeyFailure[];
}

export default function HotkeysTab({
  hotkeys,
  onChange,
  failures,
}: HotkeysTabProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Registration can fail when another app already owns the combination.
          It used to fail silently, leaving a dead shortcut on screen. */}
      {failures.length > 0 && (
        <SettingsNotice intent="warning">
          {t("hotkeys.conflict", {
            list: failures
              .map((f) => `${t(`hotkeys.${f.action}`)} (${f.accelerator})`)
              .join(", "),
          })}
        </SettingsNotice>
      )}
      {/* Binding a media key takes it away from Windows for as long as the app
          runs, so say so rather than let it surprise people. */}
      <SettingsNotice>{t("hotkeys.mediaKeysHint")}</SettingsNotice>
      {ACTIONS.map(({ key, labelKey }) => (
        <SettingRow key={key} label={t(labelKey)}>
          <HotkeyInput
            value={hotkeys[key]}
            onChange={(accelerator) => onChange(key, accelerator)}
          />
        </SettingRow>
      ))}
    </>
  );
}
