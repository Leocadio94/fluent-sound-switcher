import { useTranslation } from "react-i18next";
import { Button, Dropdown, Field, Option, Switch } from "@fluentui/react-components";

import type { NotificationConfig, OverlayPosition } from "../../lib/config";
import { POSITIONS, useSettingsStyles, type TranslationKey } from "./shared";

interface NotificationsTabProps {
  notifications: NotificationConfig;
  onChange: <K extends keyof NotificationConfig>(
    key: K,
    value: NotificationConfig[K],
  ) => void;
  onPreview: () => void;
}

export default function NotificationsTab({
  notifications,
  onChange,
  onPreview,
}: NotificationsTabProps) {
  const styles = useSettingsStyles();
  const { t } = useTranslation();

  const toggles: { key: keyof NotificationConfig; labelKey: TranslationKey }[] = [
    { key: "banner", labelKey: "notifications.banner" },
    { key: "native", labelKey: "notifications.native" },
    { key: "sound", labelKey: "notifications.sound" },
  ];

  return (
    <>
      {toggles.map(({ key, labelKey }) => (
        <Field
          key={key}
          className={styles.row}
          label={t(labelKey)}
          orientation="horizontal"
        >
          <Switch
            checked={notifications[key] as boolean}
            onChange={(_, d) => onChange(key, d.checked as never)}
          />
        </Field>
      ))}
      <Field
        className={styles.row}
        label={t("notifications.bannerPosition")}
        orientation="horizontal"
      >
        <Dropdown
          value={t(`positions.${notifications.bannerPosition}`)}
          selectedOptions={[notifications.bannerPosition]}
          onOptionSelect={(_, d) =>
            d.optionValue &&
            onChange("bannerPosition", d.optionValue as OverlayPosition)
          }
        >
          {POSITIONS.map((pos) => (
            <Option key={pos} value={pos}>
              {t(`positions.${pos}`)}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <div className={styles.testRow}>
        <Button appearance="secondary" onClick={onPreview}>
          {t("notifications.test")}
        </Button>
      </div>
    </>
  );
}
