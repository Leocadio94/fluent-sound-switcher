import { useCallback, useEffect, useRef, useState } from "react";

interface Options<T extends object> {
  /** Used until the stored value arrives. */
  defaults: T;
  load: () => Promise<T>;
  save: (value: T) => Promise<void>;
  /**
   * Applied right after saving, receiving the new value *directly*. The store
   * autosaves asynchronously, so anything the backend must honour immediately
   * has to be handed over rather than re-read from the file.
   */
  apply?: (value: T) => Promise<unknown>;
}

interface Persisted<T extends object> {
  value: T;
  setField: <K extends keyof T>(key: K, fieldValue: T[K]) => void;
}

/**
 * Loads a settings record from the store and persists every field change.
 *
 * Each settings hook used to repeat this, and all of them called `save(...)`
 * *inside* the `setState` updater. Updaters must be pure: React 19 runs them
 * twice under StrictMode, so every change wrote to disk twice and fired its
 * backend command twice. The new value is computed from a ref instead, so the
 * write happens exactly once and still cannot read stale state.
 */
export function usePersistedConfig<T extends object>({
  defaults,
  load,
  save,
  apply,
}: Options<T>): Persisted<T> {
  const [value, setValue] = useState<T>(defaults);
  const latest = useRef(value);

  useEffect(() => {
    let cancelled = false;
    void load()
      .then((loaded) => {
        if (cancelled) return;
        latest.current = loaded;
        setValue(loaded);
      })
      .catch((e) => console.error("could not load settings", e));
    return () => {
      cancelled = true;
    };
    // The loaders are module-level functions, stable by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = useCallback(
    <K extends keyof T>(key: K, fieldValue: T[K]) => {
      const next = { ...latest.current, [key]: fieldValue };
      latest.current = next;
      setValue(next);
      void save(next)
        .then(() => apply?.(next))
        .catch((e) => console.error("could not save settings", e));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { value, setField };
}
