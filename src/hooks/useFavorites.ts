import { useCallback, useEffect, useRef, useState } from "react";

import {
  EMPTY_FAVORITES,
  loadFavorites,
  loadHideUnavailable,
  loadShowOnlyFavorites,
  saveFavorites,
  saveHideUnavailable,
  saveShowOnlyFavorites,
  type Favorites,
} from "../lib/config";
import {
  pruneNames,
  reconcileFavorites,
  unlistedFavoriteIds,
  type ResolvedEndpoints,
} from "../lib/reconcileFavorites";
import {
  resolveAudioEndpoints,
  type AudioDevice,
  type DeviceDirection,
} from "../lib/tauri";
import { useTauriEvent } from "./useTauriEvent";

interface UseFavorites {
  favorites: Favorites;
  showOnlyFavorites: boolean;
  hideUnavailable: boolean;
  isFavorite: (direction: DeviceDirection, id: string) => boolean;
  toggleFavorite: (direction: DeviceDirection, id: string) => void;
  removeFavorites: (direction: DeviceDirection, ids: string[]) => void;
  setShowOnlyFavorites: (value: boolean) => void;
  setHideUnavailable: (value: boolean) => void;
}

/**
 * Loads the persisted cycle-list selection (favorites) and the "only
 * favorites" filter, and persists every change back to the store.
 *
 * Pass `devices` from exactly one window (the main one) to also keep favorites
 * attached to their hardware when Windows changes an endpoint id. Two windows
 * reconciling would write over each other.
 * @see docs/favoritos-e-ids-de-endpoint.md
 */
export function useFavorites(devices?: AudioDevice[]): UseFavorites {
  const [favorites, setFavorites] = useState<Favorites>(EMPTY_FAVORITES);
  const [showOnlyFavorites, setShowOnlyFavoritesState] = useState(false);
  const [hideUnavailable, setHideUnavailableState] = useState(false);
  const latest = useRef(favorites);
  // Nothing is written until the stored favorites were read: a write from the
  // empty initial state would wipe the other direction.
  const loaded = useRef(false);
  // Bumped by every read and write, so a read still in flight cannot undo a
  // newer one.
  const generation = useRef(0);
  // The object this hook itself just wrote; reconciling it again is a no-op.
  const justCommitted = useRef<Favorites | null>(null);

  const commit = useCallback((updated: Favorites) => {
    generation.current += 1;
    latest.current = updated;
    setFavorites(updated);
    // Persisted outside the state updater: updaters must be pure, and React 19
    // runs them twice under StrictMode, which wrote the file twice.
    void saveFavorites(updated).catch((e) =>
      console.error("could not save favorites", e),
    );
  }, []);

  /** Reads the stored favorites; true once favorites are known to be loaded. */
  const read = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const stored = await loadFavorites();
      if (mine === generation.current) {
        loaded.current = true;
        latest.current = stored;
        setFavorites(stored);
      }
      // A newer read or write took over; whether it already loaded is the answer.
      return loaded.current;
    } catch (e) {
      console.error("could not load favorites", e);
      return false;
    }
  }, []);

  // Only reads refs/stable functions, so it is safe to reuse across mounts and
  // events — see the "frozen closure" note in CLAUDE.md.
  const reload = useCallback(() => {
    void read();
    void loadShowOnlyFavorites().then(setShowOnlyFavoritesState);
    void loadHideUnavailable().then(setHideUnavailableState);
  }, [read]);

  useEffect(() => {
    reload();
  }, [reload]);

  // The flyout window is created once and lives suspended while hidden, so
  // favorite edits made in the main window never reach it; the backend pushes
  // "flyout-opened" on every flyout open.
  useTauriEvent("flyout-opened", reload, [reload]);

  useEffect(() => {
    if (!devices || devices.length === 0 || !loaded.current) return;
    if (favorites === justCommitted.current) return;
    const apply = (resolved: ResolvedEndpoints) => {
      const reconciled = reconcileFavorites(latest.current, devices, resolved);
      if (reconciled === latest.current) return;
      justCommitted.current = reconciled;
      commit(reconciled);
    };
    const unlisted = unlistedFavoriteIds(latest.current, devices);
    if (unlisted.length === 0) {
      apply({});
      return;
    }
    let cancelled = false;
    resolveAudioEndpoints(unlisted)
      .then((list) => {
        if (!cancelled) apply(Object.fromEntries(list.map((r) => [r.id, r])));
      })
      .catch((e) => console.error("could not resolve favorites", e));
    return () => {
      cancelled = true;
    };
    // `favorites` re-arms this after the first read and after each change.
  }, [devices, favorites, commit]);

  const isFavorite = useCallback(
    (direction: DeviceDirection, id: string) =>
      favorites[direction].includes(id),
    [favorites],
  );

  const edit = useCallback(
    (change: (current: Favorites) => Favorites) => {
      const apply = () => commit(pruneNames(change(latest.current)));
      if (loaded.current) {
        apply();
        return;
      }
      // Not read yet, or the first read failed: read again rather than write
      // from the empty state, and drop the edit only if that fails too.
      void read().then((ok) => {
        if (ok) apply();
      });
    },
    [commit, read],
  );

  const toggleFavorite = useCallback(
    (direction: DeviceDirection, id: string) =>
      edit((current) => {
        const list = current[direction];
        return {
          ...current,
          [direction]: list.includes(id)
            ? list.filter((x) => x !== id)
            : [...list, id],
        };
      }),
    [edit],
  );

  const removeFavorites = useCallback(
    (direction: DeviceDirection, ids: string[]) =>
      edit((current) => ({
        ...current,
        [direction]: current[direction].filter((x) => !ids.includes(x)),
      })),
    [edit],
  );

  const setShowOnlyFavorites = useCallback((value: boolean) => {
    setShowOnlyFavoritesState(value);
    void saveShowOnlyFavorites(value);
  }, []);

  const setHideUnavailable = useCallback((value: boolean) => {
    setHideUnavailableState(value);
    void saveHideUnavailable(value);
  }, []);

  return {
    favorites,
    showOnlyFavorites,
    hideUnavailable,
    isFavorite,
    toggleFavorite,
    removeFavorites,
    setShowOnlyFavorites,
    setHideUnavailable,
  };
}
