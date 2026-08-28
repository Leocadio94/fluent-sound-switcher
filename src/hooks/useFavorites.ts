import { useCallback, useEffect, useRef, useState } from "react";

import {
  EMPTY_FAVORITES,
  loadFavorites,
  loadShowOnlyFavorites,
  saveFavorites,
  saveShowOnlyFavorites,
  type Favorites,
} from "../lib/config";
import type { DeviceDirection } from "../lib/tauri";

interface UseFavorites {
  favorites: Favorites;
  showOnlyFavorites: boolean;
  isFavorite: (direction: DeviceDirection, id: string) => boolean;
  toggleFavorite: (direction: DeviceDirection, id: string) => void;
  setShowOnlyFavorites: (value: boolean) => void;
}

/**
 * Loads the persisted cycle-list selection (favorites) and the "only
 * favorites" filter, and persists every change back to the store.
 */
export function useFavorites(): UseFavorites {
  const [favorites, setFavorites] = useState<Favorites>(EMPTY_FAVORITES);
  const [showOnlyFavorites, setShowOnlyFavoritesState] = useState(false);
  const latest = useRef(favorites);

  useEffect(() => {
    void loadFavorites().then((loaded) => {
      latest.current = loaded;
      setFavorites(loaded);
    });
    void loadShowOnlyFavorites().then(setShowOnlyFavoritesState);
  }, []);

  const isFavorite = useCallback(
    (direction: DeviceDirection, id: string) =>
      favorites[direction].includes(id),
    [favorites],
  );

  const toggleFavorite = useCallback((direction: DeviceDirection, id: string) => {
    const list = latest.current[direction];
    const next = list.includes(id)
      ? list.filter((x) => x !== id)
      : [...list, id];
    const updated = { ...latest.current, [direction]: next };
    latest.current = updated;
    setFavorites(updated);
    // Persisted outside the state updater: updaters must be pure, and React 19
    // runs them twice under StrictMode, which wrote the file twice.
    void saveFavorites(updated).catch((e) =>
      console.error("could not save favorites", e),
    );
  }, []);

  const setShowOnlyFavorites = useCallback((value: boolean) => {
    setShowOnlyFavoritesState(value);
    void saveShowOnlyFavorites(value);
  }, []);

  return {
    favorites,
    showOnlyFavorites,
    isFavorite,
    toggleFavorite,
    setShowOnlyFavorites,
  };
}
