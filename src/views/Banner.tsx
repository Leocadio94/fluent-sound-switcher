import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { MicFilled, Speaker2Filled } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import "../banner.css";

interface BannerData {
  name: string;
  direction: "output" | "input";
}

/**
 * Transient toast shown in the banner window when the default device changes.
 * Driven by the backend's `banner-show` event.
 */
export default function Banner() {
  const { t } = useTranslation();
  const [data, setData] = useState<BannerData | null>(null);

  useEffect(() => {
    const unlisten = listen<BannerData>("banner-show", (e) =>
      setData(e.payload),
    );
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  if (!data) return null;
  const Icon = data.direction === "output" ? Speaker2Filled : MicFilled;

  return (
    <div className="banner-pill">
      <Icon />
      <div className="banner-text">
        <span className="banner-label">
          {data.direction === "output" ? t("common.output") : t("common.input")}
        </span>
        <span className="banner-name">{data.name}</span>
      </div>
    </div>
  );
}
