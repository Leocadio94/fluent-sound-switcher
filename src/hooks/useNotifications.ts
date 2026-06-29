import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_NOTIFICATIONS,
  loadNotifications,
  saveNotifications,
  type NotificationConfig,
} from "../lib/config";

interface UseNotifications {
  notifications: NotificationConfig;
  setField: <K extends keyof NotificationConfig>(
    key: K,
    value: NotificationConfig[K],
  ) => void;
}

/** Loads and persists the device-change notification preferences. */
export function useNotifications(): UseNotifications {
  const [notifications, setNotifications] = useState<NotificationConfig>(
    DEFAULT_NOTIFICATIONS,
  );

  useEffect(() => {
    void loadNotifications().then(setNotifications);
  }, []);

  const setField = useCallback(
    <K extends keyof NotificationConfig>(
      key: K,
      value: NotificationConfig[K],
    ) => {
      setNotifications((prev) => {
        const next = { ...prev, [key]: value };
        void saveNotifications(next);
        return next;
      });
    },
    [],
  );

  return { notifications, setField };
}
