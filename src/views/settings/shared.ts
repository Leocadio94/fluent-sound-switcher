import { makeStyles, tokens } from "@fluentui/react-components";
import type { ParseKeys } from "i18next";

/** A key that exists in the catalogue — see `i18n/react-i18next.d.ts`. */
export type TranslationKey = ParseKeys;

/**
 * Layout shared by every settings tab: a label on the left, its control on the
 * right. Each tab used to redeclare this inside one 415-line component.
 */
export const useSettingsStyles = makeStyles({
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalL,
  },
  testRow: { marginTop: tokens.spacingVerticalS },
});

/**
 * The six anchor points shared by the mute overlay and the switch banner.
 * Re-exported from the config so the dropdowns and the stored-value validation
 * can never disagree about what is allowed.
 */
export { OVERLAY_POSITIONS as POSITIONS } from "../../lib/config";
