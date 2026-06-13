import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";

import { PushNotificationsService } from "@features/notifications/services/PushNotificationsService";
import { useNotificationStore } from "@features/notifications/store/useNotificationStore";
import { useUserStore } from "@/src/store/useUserStore";

/**
 * Hydrates the notifications store + opens the realtime channel as soon as the
 * user is authenticated. Also bootstraps the OS push pipeline (permission +
 * token registration + foreground/tap listeners) once the user opts in.
 * Includes an AppState listener to detect if the user revokes permissions in OS settings.
 */
export const useNotificationsBootstrap = (): void => {
  const userId = useUserStore((state) => state.user?.id ?? null);
  const hydrate = useNotificationStore((state) => state.hydrate);
  const reset = useNotificationStore((state) => state.reset);
  const pushEnabled = useNotificationStore((state) => state.preferences.pushEnabled);
  const setPreferencesLocal = useNotificationStore((state) => state.setPreferencesLocal);

  useEffect(() => {
    if (!userId) {
      reset();
      PushNotificationsService.teardown();
      return;
    }
    hydrate(userId).catch(() => undefined);
  }, [userId, hydrate, reset]);

  useEffect(() => {
    if (!userId) return;

    const checkPermissions = async () => {
      try {
        const status = await PushNotificationsService.bootstrap({ userId, pushEnabled });
        if (pushEnabled && status !== "web" && status !== Notifications.PermissionStatus.GRANTED) {
          // User revoked permission in OS settings! Fallback state to false.
          setPreferencesLocal({ pushEnabled: false });
        }
      } catch (err) {
        // safely ignore bootstrap errors
      }
    };

    checkPermissions();

    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        checkPermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userId, pushEnabled, setPreferencesLocal]);
};
