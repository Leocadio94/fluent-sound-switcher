import "i18next";

import type ptBR from "./locales/pt-BR.json";

/**
 * Types every `t()` key against the pt-BR catalogue (the default language, and
 * the one that always has every key). Without this a typo like
 * `t("commom.output")` silently rendered the key itself at runtime.
 *
 * Note the augmented module is `i18next`, not `react-i18next`: the option bag
 * moved there in i18next 21.3, and augmenting the old one type-checks fine
 * while doing nothing.
 *
 * en.json is held to the same shape by `localeParity.ts`.
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof ptBR;
    };
  }
}
