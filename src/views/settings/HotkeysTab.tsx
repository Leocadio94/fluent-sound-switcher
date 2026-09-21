import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tab, TabList } from "@fluentui/react-components";

import GamepadTab from "./GamepadTab";
import HotkeyInput from "../../components/HotkeyInput";
import type { GamepadHotkeys, Hotkeys } from "../../lib/config";
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

type HotkeysPivot = "keyboard" | "gamepad";

interface HotkeysTabProps {
  hotkeys: Hotkeys;
  onChange: (action: keyof Hotkeys, accelerator: string) => void;
  failures: HotkeyFailure[];
  gamepad: GamepadHotkeys;
  onGamepadChange: (enabled: boolean) => void;
}

export default function HotkeysTab({
  hotkeys,
  onChange,
  failures,
  gamepad,
  onGamepadChange,
}: HotkeysTabProps) {
  const { t } = useTranslation();
  const [pivot, setPivot] = useState<HotkeysPivot>("keyboard");

  return (
    <>
      {/* Sub-level selector: the top TabList already fills the settings dialog,
          so keyboard/gamepad split lives inside the hotkeys panel itself. */}
      <TabList
        size="small"
        appearance="transparent"
        selectedValue={pivot}
        onTabSelect={(_, d) => setPivot(d.value as HotkeysPivot)}
      >
        <Tab value="keyboard">{t("hotkeys.keyboard")}</Tab>
        <Tab value="gamepad">{t("hotkeys.gamepad")}</Tab>
      </TabList>
      {pivot === "keyboard" && (
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
      )}
      {pivot === "gamepad" && (
        <GamepadTab gamepad={gamepad} onChange={onGamepadChange} />
      )}
    </>
  );
}
