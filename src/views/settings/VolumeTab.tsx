import { useTranslation } from "react-i18next";
import { Dropdown, Option, Switch } from "@fluentui/react-components";

import type { OverlayPosition, VolumeOsd } from "../../lib/config";
import SettingRow from "./SettingRow";
import { POSITIONS } from "./shared";

interface VolumeTabProps {
  osd: VolumeOsd;
  onChange: <K extends keyof VolumeOsd>(key: K, value: VolumeOsd[K]) => void;
}

export default function VolumeTab({ osd, onChange }: VolumeTabProps) {
  const { t } = useTranslation();

  return (
    <>
      <SettingRow label={t("volume.osd")} hint={t("volume.osdHint")}>
        <Switch
          checked={osd.enabled}
          onChange={(_, d) => onChange("enabled", d.checked)}
        />
      </SettingRow>

      <SettingRow label={t("volume.osdPosition")}>
        <Dropdown
          disabled={!osd.enabled}
          value={t(`positions.${osd.position}`)}
          selectedOptions={[osd.position]}
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

      <SettingRow label={t("volume.sliders")} hint={t("volume.slidersHint")}>
        <Switch
          checked={osd.sliders}
          onChange={(_, d) => onChange("sliders", d.checked)}
        />
      </SettingRow>

      <SettingRow label={t("volume.slidersInFlyout")} hint={t("volume.slidersInFlyoutHint")}>
        <Switch
          checked={osd.slidersInFlyout}
          onChange={(_, d) => onChange("slidersInFlyout", d.checked)}
        />
      </SettingRow>
    </>
  );
}
