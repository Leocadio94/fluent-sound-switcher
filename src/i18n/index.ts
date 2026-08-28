import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ptBR from "./locales/pt-BR.json";
import en from "./locales/en.json";
// Type-only: fails the build if the two catalogues drift apart.
import "./localeParity";

export const SUPPORTED_LANGUAGES = [
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "en", label: "English" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "pt-BR";

i18n.use(initReactI18next).init({
  resources: {
    "pt-BR": { translation: ptBR },
    en: { translation: en },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

/**
 * Keeps `<html lang>` in step with the active language, so assistive tech and
 * the browser's own text handling see the right one. It was pinned to pt-BR in
 * `index.html`.
 */
i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

export default i18n;
