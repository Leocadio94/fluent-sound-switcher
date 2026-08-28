/**
 * Validation and migration for the stored config.
 *
 * Every loader used to do `{ ...DEFAULTS, ...stored }` — a shallow merge with
 * no validation. A hand-edited or downgraded `config.json` holding, say,
 * `"position": "middle"` was accepted and handed to the backend, which then
 * silently fell through to its own default. Values are checked against the
 * union they belong to, and anything unrecognised falls back.
 */

/** Current schema version, stored under `schemaVersion`. */
export const SCHEMA_VERSION = 1;

/** Returns `value` when it is one of `allowed`, else `fallback`. */
export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/** A list of device ids, dropping anything that is not a string. */
export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Brings a stored document up to the current schema.
 *
 * There is only one version so far, so this just stamps existing files. It
 * exists now so the first real migration has somewhere to go, rather than being
 * bolted on once a released version is already writing an older shape.
 */
export function migrate(stored: Record<string, unknown>): Record<string, unknown> {
  const version =
    typeof stored.schemaVersion === "number" ? stored.schemaVersion : 0;
  if (version >= SCHEMA_VERSION) return stored;

  const migrated = { ...stored };
  // v0 -> v1: the pre-versioning layout is already the v1 shape; every reader
  // validates its own values, so nothing needs rewriting here. The stamp is
  // what matters, so the next migration knows where it is starting from.
  migrated.schemaVersion = SCHEMA_VERSION;
  return migrated;
}
