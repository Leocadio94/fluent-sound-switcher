import { useTranslation } from "react-i18next";
import { Dropdown, Option, Switch } from "@fluentui/react-components";

import {
  MUTE_INDICATOR_MODES as MODES,
  OVERLAY_STYLES as STYLES,
  type MuteIndicator,
  type MuteIndicatorMode,
  type OverlayPosition,
  type OverlayStyle,
} from "../../lib/config";
import type { useMicMute } from "../../hooks/useMicMute";
import SettingRow from "./SettingRow";
import { POSITIONS } from "./shared";

interface MuteTabProps {
  indicator: MuteIndicator;
  micMute: ReturnType<typeof useMicMute>;
  onChange: <K extends keyof MuteIndicator>(
    key: K,
    value: MuteIndicator[K],
  ) => void;
}

export default function MuteTab({ indicator, micMute, onChange }: MuteTabProps) {
  const { t } = useTranslation();

  return (
    <>
      <SettingRow
        label={t("muteIndicator.allDevices")}
        hint={t("muteIndicator.allDevicesHint")}
      >
        <Switch
          checked={micMute.allDevices}
          onChange={(_, d) => micMute.setAllDevices(d.checked)}
        />
      </SettingRow>
      <SettingRow
        label={t("muteIndicator.callShortcut")}
        hint={t("muteIndicator.callShortcutHint")}
      >
        <Switch
          checked={micMute.callShortcut}
          onChange={(_, d) => micMute.setCallShortcut(d.checked)}
        />
      </SettingRow>
      <SettingRow label={t("muteIndicator.mode")}>
        <Dropdown
          value={t(`muteIndicator.modes.${indicator.mode}`)}
          selectedOptions={[indicator.mode]}
          onOptionSelect={(_, d) =>
            d.optionValue && onChange("mode", d.optionValue as MuteIndicatorMode)
          }
        >
          {MODES.map((mode) => (
            <Option key={mode} value={mode}>
              {t(`muteIndicator.modes.${mode}`)}
            </Option>
          ))}
        </Dropdown>
      </SettingRow>
      <SettingRow label={t("muteIndicator.position")}>
        <Dropdown
          value={t(`positions.${indicator.position}`)}
          selectedOptions={[indicator.position]}
          onOptionSelect={(_, d) =>
            d.optionValue &&
            onChange("position", d.optionValue as OverlayPosition)
          }
        >
          {POSITIONS.map((pos) => (
            <Option key={pos} value={pos}>
              {t(`positions.${pos}`)}
            </Option>
          ))}
        </Dropdown>
      </SettingRow>
      <SettingRow label={t("muteIndicator.style")}>
        <Dropdown
          value={t(`muteIndicator.styles.${indicator.style}`)}
          selectedOptions={[indicator.style]}
          onOptionSelect={(_, d) =>
            d.optionValue && onChange("style", d.optionValue as OverlayStyle)
          }
        >
          {STYLES.map((style) => (
            <Option key={style} value={style}>
              {t(`muteIndicator.styles.${style}`)}
            </Option>
          ))}
        </Dropdown>
      </SettingRow>
    </>
  );
}
