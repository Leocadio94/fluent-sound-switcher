import { useTranslation } from "react-i18next";
import {
  Button,
  Switch,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowClockwiseRegular,
  MicProhibitedFilled,
  MicRegular,
  SettingsRegular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  controls: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  divider: {
    width: tokens.strokeWidthThin,
    alignSelf: "stretch",
    marginBlock: tokens.spacingVerticalXS,
    marginInline: tokens.spacingHorizontalXXS,
    backgroundColor: tokens.colorNeutralStroke2,
  },
});

interface AppControlsProps {
  showOnlyFavorites: boolean;
  onShowOnlyFavoritesChange: (value: boolean) => void;
  muted: boolean;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * The app's own controls: the favourites filter, the mic toggle, settings and
 * refresh.
 *
 * They live in the custom title bar when the app draws it — which is what the
 * caption's empty middle is for — and fall back to a header row when Windows
 * draws the caption instead.
 */
export default function AppControls({
  showOnlyFavorites,
  onShowOnlyFavoritesChange,
  muted,
  onToggleMute,
  onOpenSettings,
  onRefresh,
  refreshing,
}: AppControlsProps) {
  const styles = useStyles();
  const { t } = useTranslation();

  return (
    <div className={styles.controls}>
      <Switch
        checked={showOnlyFavorites}
        onChange={(_, data) => onShowOnlyFavoritesChange(data.checked)}
        label={t("devices.onlyFavorites")}
        labelPosition="before"
      />
      <div className={styles.divider} />
      <Tooltip
        content={muted ? t("muteIndicator.muted") : t("muteIndicator.live")}
        relationship="label"
      >
        <Button
          size="small"
          icon={muted ? <MicProhibitedFilled /> : <MicRegular />}
          appearance={muted ? "primary" : "subtle"}
          aria-pressed={muted}
          aria-label={muted ? t("muteIndicator.muted") : t("muteIndicator.live")}
          onClick={onToggleMute}
        />
      </Tooltip>
      <Tooltip content={t("settings.title")} relationship="label">
        <Button
          size="small"
          icon={<SettingsRegular />}
          appearance="subtle"
          aria-label={t("settings.title")}
          onClick={onOpenSettings}
        />
      </Tooltip>
      <Tooltip content={t("common.refresh")} relationship="label">
        <Button
          size="small"
          icon={<ArrowClockwiseRegular />}
          appearance="subtle"
          aria-label={t("common.refresh")}
          onClick={onRefresh}
          disabled={refreshing}
        />
      </Tooltip>
    </div>
  );
}
