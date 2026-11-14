import { useTranslation } from "react-i18next";
import {
  Body1,
  Button,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  DismissRegular,
  MicRegular,
  PlugDisconnectedRegular,
  Speaker2Regular,
} from "@fluentui/react-icons";

import type { MissingFavorite } from "../lib/reconcileFavorites";
import type { DeviceDirection } from "../lib/tauri";

const useStyles = makeStyles({
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS} ${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusLarge,
    border: `${tokens.strokeWidthThin} dashed ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
  },
  icon: { fontSize: "20px", flexShrink: 0 },
  name: {
    flexGrow: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
    flexShrink: 0,
    fontSize: tokens.fontSizeBase200,
  },
});

interface MissingFavoriteRowProps {
  favorite: MissingFavorite;
  direction: DeviceDirection;
  onRemove: (id: string) => void;
}

/**
 * A favorite whose device Windows no longer lists (the endpoint id changed, or
 * the hardware is gone). Kept visible so it never disappears silently; the user
 * decides when to drop it.
 */
export default function MissingFavoriteRow({
  favorite,
  direction,
  onRemove,
}: MissingFavoriteRowProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const Icon = direction === "output" ? Speaker2Regular : MicRegular;

  return (
    <div className={styles.row}>
      <Icon className={styles.icon} />
      <Body1 className={styles.name}>
        {favorite.name ?? t("devices.missingUnnamed")}
      </Body1>
      <span className={styles.label}>
        <PlugDisconnectedRegular />
        {t("devices.missing")}
      </span>
      <Tooltip content={t("devices.removeMissing")} relationship="label">
        <Button
          appearance="subtle"
          size="small"
          icon={<DismissRegular />}
          onClick={() => onRemove(favorite.id)}
        />
      </Tooltip>
    </div>
  );
}
