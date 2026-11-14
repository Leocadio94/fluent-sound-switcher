import type { Favorites } from "./config";
import type { AudioDevice, DeviceDirection, ResolvedEndpoint } from "./tauri";

const DIRECTIONS: readonly DeviceDirection[] = ["output", "input"];

export type ResolvedEndpoints = Record<string, ResolvedEndpoint>;

/** A favorite whose device is not in the list. */
export interface MissingFavorite {
  id: string;
  /** Last known friendly name, if one was ever recorded. */
  name: string | null;
}

/** Windows renames "Headset (X)" to "Headset (3- X)" on another USB port. */
export function comparableName(name: string): string {
  return name.replace(/\(\d+-\s*/, "(");
}

const isListed = (devices: AudioDevice[], direction: DeviceDirection, id: string) =>
  devices.some((d) => d.direction === direction && d.id === id);

/** Favorite ids the device list does not contain, across both directions. */
export function unlistedFavoriteIds(
  favorites: Favorites,
  devices: AudioDevice[],
): string[] {
  return DIRECTIONS.flatMap((direction) =>
    favorites[direction].filter((id) => !isListed(devices, direction, id)),
  );
}

/**
 * Favorites to show as "not found". Empty when the list itself is empty: a
 * failed enumeration would otherwise make every favorite look orphaned.
 */
export function missingFavorites(
  favorites: Favorites,
  devices: AudioDevice[],
  direction: DeviceDirection,
): MissingFavorite[] {
  if (devices.length === 0) return [];
  return favorites[direction]
    .filter((id) => !isListed(devices, direction, id))
    .map((id) => ({ id, name: favorites.names[id] ?? null }));
}

/** Drops the recorded names of ids that are no longer favorites. */
export function pruneNames(favorites: Favorites): Favorites {
  const kept = new Set([...favorites.output, ...favorites.input]);
  const stale = Object.keys(favorites.names).filter((id) => !kept.has(id));
  if (stale.length === 0) return favorites;
  const names = { ...favorites.names };
  for (const id of stale) delete names[id];
  return { ...favorites, names };
}

function sameFavorites(a: Favorites, b: Favorites): boolean {
  const sameList = (x: string[], y: string[]) =>
    x.length === y.length && x.every((id, i) => id === y[i]);
  const namesA = Object.entries(a.names);
  return (
    sameList(a.output, b.output) &&
    sameList(a.input, b.input) &&
    namesA.length === Object.keys(b.names).length &&
    namesA.every(([id, name]) => b.names[id] === name)
  );
}

/**
 * Re-points favorites whose endpoint is gone at the single same-named device
 * that replaced it, and records the names it can. Returns `favorites` itself
 * when nothing changed.
 * @see docs/favoritos-e-ids-de-endpoint.md
 */
export function reconcileFavorites(
  favorites: Favorites,
  devices: AudioDevice[],
  resolved: ResolvedEndpoints,
): Favorites {
  const names = { ...favorites.names };
  const next: Favorites = { output: [], input: [], names };

  for (const direction of DIRECTIONS) {
    const listed = devices.filter((d) => d.direction === direction);
    const current = new Set(favorites[direction]);

    const gone = new Map<string, string[]>();
    for (const id of favorites[direction]) {
      const device = listed.find((d) => d.id === id);
      if (device) {
        names[id] = device.name;
        continue;
      }
      const endpoint = resolved[id];
      if (!names[id] && endpoint?.name) names[id] = endpoint.name;
      // Unplugged or unresolved is not gone: that is a list snapshot mid-churn.
      if (endpoint?.state !== "notpresent" && endpoint?.state !== "missing") continue;
      if (!names[id]) continue;
      const key = comparableName(names[id]);
      gone.set(key, [...(gone.get(key) ?? []), id]);
    }

    const replacement = new Map<string, string>();
    for (const [key, ids] of gone) {
      const candidates = listed.filter(
        (d) => comparableName(d.name) === key && !current.has(d.id),
      );
      const active = candidates.filter((d) => d.state === "active");
      // Two candidates is a guess, and a wrong swap is worse than none.
      const pool = active.length > 0 ? active : candidates;
      if (pool.length !== 1) continue;
      names[pool[0].id] = pool[0].name;
      for (const id of ids) replacement.set(id, pool[0].id);
    }

    for (const id of favorites[direction]) {
      const target = replacement.get(id) ?? id;
      if (!next[direction].includes(target)) next[direction].push(target);
    }
  }

  const pruned = pruneNames(next);
  return sameFavorites(favorites, pruned) ? favorites : pruned;
}
