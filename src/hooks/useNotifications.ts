import {
  DEFAULT_NOTIFICATIONS,
  loadNotifications,
  saveNotifications,
  type NotificationConfig,
} from "../lib/config";
import { usePersistedConfig } from "./usePersistedConfig";

interface UseNotifications {
  notifications: NotificationConfig;
  setField: <K extends keyof NotificationConfig>(
    key: K,
    value: NotificationConfig[K],
  ) => void;
}

/** Loads and persists the device-change notification preferences. */
export function useNotifications(): UseNotifications {
  const { value, setField } = usePersistedConfig({
    defaults: DEFAULT_NOTIFICATIONS,
    load: loadNotifications,
    save: saveNotifications,
  });

  return { notifications: value, setField };
}
