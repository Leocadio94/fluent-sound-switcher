import { useTranslation } from "react-i18next";
import { Button, Dropdown, Option, Switch } from "@fluentui/react-components";

import { useGeneral } from "../../hooks/useGeneral";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import {
  AUTO_SWITCH_MODES,
  MONITOR_PREFERENCES as MONITORS,
  TITLE_BAR_STYLES,
  saveLanguage,
  type MonitorPreference,
  type TitleBarStyle,
} from "../../lib/config";
import { openLogFolder, setLanguage } from "../../lib/tauri";
import type { ThemePreference } from "../../theme/useSystemTheme";
import type { AutoSwitchConfig, AutoSwitchMode } from "../../lib/config";
import SettingRow from "./SettingRow";

const THEMES: ThemePreference[] = ["system", "light", "dark"];

interface GeneralTabProps {
  themePref: ThemePreference;
  onThemePrefChange: (pref: ThemePreference) => void;
  useSystemAccent: boolean;
  onUseSystemAccentChange: (value: boolean) => void;
  titleBarStyle: TitleBarStyle;
  onTitleBarStyleChange: (value: TitleBarStyle) => void;
  autoSwitch: AutoSwitchConfig;
  onAutoSwitchChange: <K extends keyof AutoSwitchConfig>(
    key: K,
    value: AutoSwitchConfig[K],
  ) => void;
}

export default function GeneralTab({
  themePref,
  onThemePrefChange,
  useSystemAccent,
  onUseSystemAccentChange,
  titleBarStyle,
  onTitleBarStyleChange,
  autoSwitch,
  onAutoSwitchChange,
}: GeneralTabProps) {
  const { t, i18n } = useTranslation();
  const general = useGeneral();

  return (
    <>
      <SettingRow label={t("settings.language")}>
        <Dropdown
          value={
            SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)?.label ??
            i18n.language
          }
          selectedOptions={[i18n.language]}
          onOptionSelect={(_, d) => {
            if (!d.optionValue) return;
            const language = d.optionValue;
            void i18n.changeLanguage(language);
            // Persist it, and hand it to the backend directly: the tray menu
            // and notification titles are translated there, and the store
            // write is async.
            void saveLanguage(language);
            void setLanguage(language);
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <Option key={lang.code} value={lang.code}>
              {lang.label}
            </Option>
          ))}
        </Dropdown>
      </SettingRow>

      <SettingRow label={t("settings.theme")}>
        <Dropdown
          value={t(`settings.themes.${themePref}`)}
          selectedOptions={[themePref]}
          onOptionSelect={(_, d) =>
            d.optionValue && onThemePrefChange(d.optionValue as ThemePreference)
          }
        >
          {THEMES.map((option) => (
            <Option key={option} value={option}>
              {t(`settings.themes.${option}`)}
            </Option>
          ))}
        </Dropdown>
      </SettingRow>

      <SettingRow label={t("settings.titleBar")} hint={t("settings.titleBarHint")}>
        <Dropdown
          value={t(`settings.titleBars.${titleBarStyle}`)}
          selectedOptions={[titleBarStyle]}
          onOptionSelect={(_, d) =>
            d.optionValue && onTitleBarStyleChange(d.optionValue as TitleBarStyle)
          }
        >
          {TITLE_BAR_STYLES.map((style) => (
            <Option key={style} value={style}>
              {t(`settings.titleBars.${style}`)}
            </Option>
          ))}
        </Dropdown>
      </SettingRow>

      <SettingRow label={t("settings.systemAccent")} hint={t("settings.systemAccentHint")}>
        <Switch
          checked={useSystemAccent}
          onChange={(_, d) => onUseSystemAccentChange(d.checked)}
        />
      </SettingRow>

      <SettingRow label={t("settings.autostart")}>
        <Switch
          checked={general.autostart}
          onChange={(_, d) => general.setAutostart(d.checked)}
        />
      </SettingRow>

      <SettingRow label={t("settings.startMinimized")}>
        <Switch
          disabled={!general.autostart}
          checked={general.startMinimized}
          onChange={(_, d) => general.setStartMinimized(d.checked)}
        />
      </SettingRow>

      <SettingRow label={t("settings.showDeviceIcon")} hint={t("settings.showDeviceIconHint")}>
        <Switch
          checked={general.showDeviceIcon}
          onChange={(_, d) => general.setShowDeviceIcon(d.checked)}
        />
      </SettingRow>

      <SettingRow label={t("autoSwitch.enabled")} hint={t("autoSwitch.hint")}>
        <Switch
          checked={autoSwitch.enabled}
          onChange={(_, d) => onAutoSwitchChange("enabled", d.checked)}
        />
      </SettingRow>

      <SettingRow label={t("autoSwitch.mode")}>
        <Dropdown
          disabled={!autoSwitch.enabled}
          value={t(`autoSwitch.modes.${autoSwitch.mode}`)}
          selectedOptions={[autoSwitch.mode]}
          onOptionSelect={(_, d) =>
            d.optionValue &&
            onAutoSwitchChange("mode", d.optionValue as AutoSwitchMode)
          }
        >
          {AUTO_SWITCH_MODES.map((mode) => (
            <Option key={mode} value={mode}>
              {t(`autoSwitch.modes.${mode}`)}
            </Option>
          ))}
        </Dropdown>
      </SettingRow>

      <SettingRow label={t("general.monitor")} hint={t("general.monitorHint")}>
        <Dropdown
          value={t(`general.monitors.${general.monitor}`)}
          selectedOptions={[general.monitor]}
          onOptionSelect={(_, d) =>
            d.optionValue &&
            general.setMonitor(d.optionValue as MonitorPreference)
          }
        >
          {MONITORS.map((monitor) => (
            <Option key={monitor} value={monitor}>
              {t(`general.monitors.${monitor}`)}
            </Option>
          ))}
        </Dropdown>
      </SettingRow>

      <SettingRow label={t("general.logs")} hint={t("general.logsHint")}>
        <Button onClick={() => void openLogFolder()}>
          {t("general.openLogs")}
        </Button>
      </SettingRow>
    </>
  );
}
