import { useTranslation } from "react-i18next";
import { Dropdown, Field, Option, Switch } from "@fluentui/react-components";

import type { OverlayPosition, VolumeOsd } from "../../lib/config";
import { POSITIONS, useSettingsStyles } from "./shared";

interface VolumeTabProps {
  osd: VolumeOsd;
  onChange: <K extends keyof VolumeOsd>(key: K, value: VolumeOsd[K]) => void;
}

export default function VolumeTab({ osd, onChange }: VolumeTabProps) {
  const styles = useSettingsStyles();
  const { t } = useTranslation();

  return (
    <>
      <Field
        className={styles.row}
        label={t("volume.osd")}
        hint={t("volume.osdHint")}
        orientation="horizontal"
      >
        <Switch
          checked={osd.enabled}
          onChange={(_, d) => onChange("enabled", d.checked)}
        />
      </Field>

      <Field
        className={styles.row}
        label={t("volume.osdPosition")}
        orientation="horizontal"
      >
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
      </Field>

      <Field
        className={styles.row}
        label={t("volume.sliders")}
        hint={t("volume.slidersHint")}
        orientation="horizontal"
      >
        <Switch
          checked={osd.sliders}
          onChange={(_, d) => onChange("sliders", d.checked)}
        />
      </Field>

      <Field
        className={styles.row}
        label={t("volume.slidersInFlyout")}
        hint={t("volume.slidersInFlyoutHint")}
        orientation="horizontal"
      >
        <Switch
          checked={osd.slidersInFlyout}
          onChange={(_, d) => onChange("slidersInFlyout", d.checked)}
        />
      </Field>
    </>
  );
}
