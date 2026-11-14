import { useCallback, useEffect, useRef, useState } from "react";

import {
  EMPTY_FAVORITES,
  loadFavorites,
  loadShowOnlyFavorites,
  saveFavorites,
  saveShowOnlyFavorites,
  type Favorites,
} from "../lib/config";
import {
  reconcileFavorites,
  unlistedFavoriteIds,
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
  isFavorite: (direction: DeviceDirection, id: string) => boolean;
  toggleFavorite: (direction: DeviceDirection, id: string) => void;
  removeFavorites: (direction: DeviceDirection, ids: string[]) => void;
  setShowOnlyFavorites: (value: boolean) => void;
}

/**
 * Loads the persisted cycle-list selection (favorites) and the "only
 * favorites" filter, and persists every change back to the store.
 *
 * Pass `devices` from exactly one window (the main one) to also keep favorites
 * attached to their hardware when Windows changes an endpoint id. Two windows
 * reconciling would write over each other.
 */
export function useFavorites(devices?: AudioDevice[]): UseFavorites {
  const [favorites, setFavorites] = useState<Favorites>(EMPTY_FAVORITES);
  const [showOnlyFavorites, setShowOnlyFavoritesState] = useState(false);
  const latest = useRef(favorites);
  // Nothing is written until the stored favorites were read: a write from the
  // empty initial state would wipe the other direction.
  const loaded = useRef(false);
  const ready = useRef<Promise<void>>(Promise.resolve());
  // Bumped by every write, so a read still in flight cannot undo it.
  const generation = useRef(0);

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

  // Only reads refs/stable functions, so it is safe to reuse across mounts and
  // events — see the "frozen closure" note in CLAUDE.md.
  const reload = useCallback(() => {
    const mine = ++generation.current;
    ready.current = loadFavorites()
      .then((stored) => {
        if (mine !== generation.current) return;
        loaded.current = true;
        latest.current = stored;
        setFavorites(stored);
      })
      .catch((e) => console.error("could not load favorites", e));
    void loadShowOnlyFavorites().then(setShowOnlyFavoritesState);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // The flyout window is created once and lives suspended while hidden, so
  // favorite edits made in the main window never reach it; the backend pushes
  // "favorites-changed" on every flyout open.
  useTauriEvent("favorites-changed", reload, [reload]);

  useEffect(() => {
    if (!devices || devices.length === 0 || !loaded.current) return;
    const unlisted = unlistedFavoriteIds(latest.current, devices);
    const apply = (resolved: Parameters<typeof reconcileFavorites>[2]) => {
      const reconciled = reconcileFavorites(latest.current, devices, resolved);
      if (reconciled !== latest.current) commit(reconciled);
    };
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
      const apply = () => commit(change(latest.current));
      if (loaded.current) apply();
      else
        void ready.current.then(() => {
          if (loaded.current) apply();
        });
    },
    [commit],
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

  return {
    favorites,
    showOnlyFavorites,
    isFavorite,
    toggleFavorite,
    removeFavorites,
    setShowOnlyFavorites,
  };
}
