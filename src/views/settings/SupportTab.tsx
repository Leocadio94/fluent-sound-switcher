import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Link, Text, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowClockwiseRegular, BugRegular } from "@fluentui/react-icons";

import { checkUpdates, getAppVersion, openUrl } from "../../lib/tauri";
import SettingRow from "./SettingRow";

const ISSUES_URL = "https://github.com/Leocadio94/fluent-sound-switcher/issues";
const LICENSE_URL =
  "https://github.com/Leocadio94/fluent-sound-switcher/blob/master/LICENSE";

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
  footer: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    marginTop: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalM,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
  },
});

export default function SupportTab() {
  const { t } = useTranslation();
  const styles = useStyles();
  const [version, setVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAppVersion().then((v) => {
      if (!cancelled) setVersion(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Text className={styles.intro}>{t("support.intro")}</Text>

      <div className={styles.actions}>
        <SettingRow
          label={t("support.checkUpdates")}
          hint={t("support.checkUpdatesHint")}
        >
          <Button
            icon={<ArrowClockwiseRegular />}
            appearance="primary"
            disabled={checking}
            onClick={() => {
              setChecking(true);
              void checkUpdates().finally(() => setChecking(false));
            }}
          >
            {checking ? t("support.checking") : t("support.checkUpdates")}
          </Button>
        </SettingRow>

        <SettingRow label={t("support.reportBug")} hint={t("support.reportBugHint")}>
          <Button
            icon={<BugRegular />}
            onClick={() => void openUrl(ISSUES_URL)}
          >
            {t("support.openIssues")}
          </Button>
        </SettingRow>
      </div>

      <div className={styles.footer}>
        <Text size={200}>
          {version
            ? t("support.version", { version })
            : t("support.versionLoading")}
        </Text>
        <Text size={200}>{t("support.license", { license: "MIT" })}</Text>
        <Text size={200}>
          {t("support.copyright")} ·{" "}
          <Link href={LICENSE_URL} target="_blank" rel="noreferrer">
            {t("support.viewLicense")}
          </Link>
        </Text>
      </div>
    </>
  );
}
