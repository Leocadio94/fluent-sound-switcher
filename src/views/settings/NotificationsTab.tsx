import { useTranslation } from "react-i18next";
import { Button, Dropdown, Option, Switch } from "@fluentui/react-components";

import type { NotificationConfig, OverlayPosition } from "../../lib/config";
import SettingRow from "./SettingRow";
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
        <SettingRow key={key} label={t(labelKey)}>
          <Switch
            checked={notifications[key] as boolean}
            onChange={(_, d) => onChange(key, d.checked as never)}
          />
        </SettingRow>
      ))}
      <SettingRow label={t("notifications.bannerPosition")}>
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
      </SettingRow>
      <div className={styles.testRow}>
        <Button appearance="secondary" onClick={onPreview}>
          {t("notifications.test")}
        </Button>
      </div>
    </>
  );
}
