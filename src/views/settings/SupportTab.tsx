import { useTranslation } from "react-i18next";
import { Button, Text, makeStyles, tokens } from "@fluentui/react-components";
import { BugRegular } from "@fluentui/react-icons";

import { openUrl } from "../../lib/tauri";
import SettingRow from "./SettingRow";

const ISSUES_URL = "https://github.com/Leocadio94/fluent-sound-switcher/issues";

const useStyles = makeStyles({
  intro: {
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalL,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
});

export default function SupportTab() {
  const { t } = useTranslation();
  const styles = useStyles();

  return (
    <>
      <Text className={styles.intro}>{t("support.intro")}</Text>

      <div className={styles.actions}>
        <SettingRow label={t("support.reportBug")} hint={t("support.reportBugHint")}>
          <Button
            icon={<BugRegular />}
            appearance="primary"
            onClick={() => void openUrl(ISSUES_URL)}
          >
            {t("support.openIssues")}
          </Button>
        </SettingRow>
      </div>
    </>
  );
}