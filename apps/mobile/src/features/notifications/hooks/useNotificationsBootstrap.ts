import { useEffect } from "react";

import { PushNotificationsService } from "@features/notifications/services/PushNotificationsService";
import { useNotificationStore } from "@features/notifications/store/useNotificationStore";
import { useUserStore } from "@/src/store/useUserStore";

/**
 * Hydrates the notifications store + opens the realtime channel as soon as the
 * user is authenticated. Also bootstraps the OS push pipeline (permission +
 * token registration + foreground/tap listeners) once the user opts in.
 */
export const useNotificationsBootstrap = (): void => {
  const userId = useUserStore((state) => state.user?.id ?? null);
  const hydrate = useNotificationStore((state) => state.hydrate);
  const reset = useNotificationStore((state) => state.reset);
  const pushEnabled = useNotificationStore((state) => state.preferences.pushEnabled);

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
    PushNotificationsService.bootstrap({ userId, pushEnabled }).catch(() => undefined);
  }, [userId, pushEnabled]);
};
