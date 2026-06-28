import { useTranslation } from "react-i18next";
import {
  Body1,
  Button,
  Dropdown,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Switch,
  Title2,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import {
  ArrowClockwiseRegular,
  MicProhibitedFilled,
  MicRegular,
  SettingsRegular,
} from "@fluentui/react-icons";

import DeviceList from "./views/DeviceList";
import SettingsDialog from "./views/SettingsDialog";
import { useDevices } from "./hooks/useDevices";
import { useFavorites } from "./hooks/useFavorites";
import { useHotkeys } from "./hooks/useHotkeys";
import { useMute } from "./hooks/useMute";
import { useMuteIndicator } from "./hooks/useMuteIndicator";
import { SUPPORTED_LANGUAGES } from "./i18n";
import type { ThemePreference } from "./theme/useSystemTheme";

const useStyles = makeStyles({
  root: {
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXL}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  headerControls: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingHorizontalXL,
    overflowY: "auto",
  },
  toolbar: {
    display: "flex",
    justifyContent: "flex-end",
  },
  centered: {
    display: "flex",
    justifyContent: "center",
    padding: tokens.spacingVerticalXXL,
  },
  langDropdown: {
    minWidth: "150px",
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
  const { devices, loading, error, refresh, switchTo, switching } =
    useDevices();
  const {
    isFavorite,
    toggleFavorite,
    showOnlyFavorites,
    setShowOnlyFavorites,
  } = useFavorites();
  const { hotkeys, setBinding } = useHotkeys();
  const { indicator, setField: setIndicatorField } = useMuteIndicator();
  const { muted, toggle: toggleMute } = useMute();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Title2>{t("app.title")}</Title2>
        <div className={styles.headerControls}>
          <Dropdown
            className={styles.langDropdown}
            value={
              SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)?.label ??
              i18n.language
            }
            selectedOptions={[i18n.language]}
            onOptionSelect={(_, data) => {
              if (data.optionValue) void i18n.changeLanguage(data.optionValue);
            }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Option key={lang.code} value={lang.code}>
                {lang.label}
              </Option>
            ))}
          </Dropdown>
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
          <Tooltip
            content={muted ? t("muteIndicator.muted") : t("muteIndicator.live")}
            relationship="label"
          >
            <Button
              icon={muted ? <MicProhibitedFilled /> : <MicRegular />}
              appearance={muted ? "primary" : "subtle"}
              onClick={toggleMute}
            />
          </Tooltip>
          <Tooltip content={t("settings.title")} relationship="label">
            <Button
              icon={<SettingsRegular />}
              appearance="subtle"
              onClick={() => setSettingsOpen(true)}
            />
          </Tooltip>
          <Tooltip content={t("common.refresh")} relationship="label">
            <Button
              icon={<ArrowClockwiseRegular />}
              appearance="subtle"
              onClick={() => void refresh()}
              disabled={loading}
            />
          </Tooltip>
        </div>
      </header>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        hotkeys={hotkeys}
        onHotkeyChange={setBinding}
        indicator={indicator}
        onIndicatorChange={setIndicatorField}
      />

      <main className={styles.content}>
        {error && (
          <MessageBar intent="error">
            <MessageBarBody>
              {t("common.error")}: {error}
            </MessageBarBody>
          </MessageBar>
        )}

        {loading ? (
          <div className={styles.centered}>
            <Spinner label={t("common.loading")} />
          </div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <Switch
                checked={showOnlyFavorites}
                onChange={(_, data) => setShowOnlyFavorites(data.checked)}
                label={t("devices.onlyFavorites")}
                labelPosition="before"
              />
            </div>
            <DeviceList
              devices={devices}
              switching={switching}
              onSwitch={(device) => void switchTo(device)}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              showOnlyFavorites={showOnlyFavorites}
            />
          </>
        )}

        {!loading && devices.length === 0 && !error && (
          <Body1>{t("common.noDevices")}</Body1>
        )}
      </main>
    </div>
  );
}
