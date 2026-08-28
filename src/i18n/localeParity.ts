import type ptBR from "./locales/pt-BR.json";
import en from "./locales/en.json";

/**
 * Same shape as `T`, but every leaf must be a string — so a locale cannot go
 * missing a key, gain an extra one, or nest it differently.
 */
type SameShape<T> = {
  [K in keyof T]: T[K] extends object ? SameShape<T[K]> : string;
};

/**
 * Compile-time check that en.json matches pt-BR.json key for key.
 *
 * Every user-facing string has to exist in both catalogues (see AGENTS.md), and
 * until now nothing enforced it: a key added to one file only showed up as the
 * raw key at runtime, in whichever language was not updated.
 */
const _enMatchesPtBr: SameShape<typeof ptBR> = en;
void _enMatchesPtBr;
