import { useTranslation } from "react-i18next";
import {
  Body1,
  Dropdown,
  Option,
  Subtitle1,
  Title1,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

import { SUPPORTED_LANGUAGES } from "./i18n";
import type { ThemePreference } from "./theme/useSystemTheme";

const useStyles = makeStyles({
  root: {
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalXXL,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  controls: {
    display: "flex",
    gap: tokens.spacingHorizontalL,
    flexWrap: "wrap",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    minWidth: "220px",
  },
  placeholder: {
    marginTop: tokens.spacingVerticalXL,
    color: tokens.colorNeutralForeground3,
  },
});

interface AppProps {
  themePref: ThemePreference;
  onThemePrefChange: (pref: ThemePreference) => void;
}

const THEME_OPTIONS: ThemePreference[] = ["system", "light", "dark"];

export default function App({ themePref, onThemePrefChange }: AppProps) {
  const styles = useStyles();
  const { t, i18n } = useTranslation();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Title1>{t("app.title")}</Title1>
        <Subtitle1>{t("app.subtitle")}</Subtitle1>
      </div>

      <div className={styles.controls}>
        <div className={styles.field}>
          <Body1>{t("settings.language")}</Body1>
          <Dropdown
            value={
              SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)?.label ??
              i18n.language
            }
            selectedOptions={[i18n.language]}
            onOptionSelect={(_, data) => {
              if (data.optionValue) i18n.changeLanguage(data.optionValue);
            }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Option key={lang.code} value={lang.code}>
                {lang.label}
              </Option>
            ))}
          </Dropdown>
        </div>

        <div className={styles.field}>
          <Body1>{t("settings.theme")}</Body1>
          <Dropdown
            value={t(`settings.theme.${themePref}`)}
            selectedOptions={[themePref]}
            onOptionSelect={(_, data) => {
              if (data.optionValue)
                onThemePrefChange(data.optionValue as ThemePreference);
            }}
          >
            {THEME_OPTIONS.map((opt) => (
              <Option key={opt} value={opt}>
                {t(`settings.theme.${opt}`)}
              </Option>
            ))}
          </Dropdown>
        </div>
      </div>

      <Body1 className={styles.placeholder}>
        {/* Fase 1 substitui isto pela lista de dispositivos real. */}
        {t("common.loading")}
      </Body1>
    </div>
  );
}
