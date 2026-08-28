import { useTranslation } from "react-i18next";
import { Dropdown, Field, Option } from "@fluentui/react-components";

import {
  MUTE_INDICATOR_MODES as MODES,
  OVERLAY_STYLES as STYLES,
  type MuteIndicator,
  type MuteIndicatorMode,
  type OverlayPosition,
  type OverlayStyle,
} from "../../lib/config";
import { POSITIONS, useSettingsStyles } from "./shared";

interface MuteTabProps {
  indicator: MuteIndicator;
  onChange: <K extends keyof MuteIndicator>(
    key: K,
    value: MuteIndicator[K],
  ) => void;
}

export default function MuteTab({ indicator, onChange }: MuteTabProps) {
  const styles = useSettingsStyles();
  const { t } = useTranslation();

  return (
    <>
      <Field
        className={styles.row}
        label={t("muteIndicator.mode")}
        orientation="horizontal"
      >
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
      </Field>
      <Field
        className={styles.row}
        label={t("muteIndicator.position")}
        orientation="horizontal"
      >
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
      </Field>
      <Field
        className={styles.row}
        label={t("muteIndicator.style")}
        orientation="horizontal"
      >
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
      </Field>
    </>
  );
}
