import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { navigate } from "@app/navigation/navigationRef";
import { PushTokenService } from "@features/notifications/services/PushTokenService";
import type { NotificationDeeplink } from "@features/notifications/types/notification";

export type PushBootstrapInput = {
  userId: string;
  pushEnabled: boolean;
};

let foregroundHandlerSet = false;
let responseSubscription: Notifications.EventSubscription | null = null;
let receivedSubscription: Notifications.EventSubscription | null = null;
let lastRegisteredToken: string | null = null;

const ensureForegroundHandler = () => {
  if (foregroundHandlerSet) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  foregroundHandlerSet = true;
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "General",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#22C55E",
  });
};

const resolveProjectId = (): string | undefined => {
  const easProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  if (typeof easProjectId === "string" && easProjectId.length > 0) {
    return easProjectId;
  }
  return undefined;
};

const requestPermission = async (): Promise<boolean> => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
};

const getExpoToken = async (): Promise<string | null> => {
  const projectId = resolveProjectId();
  try {
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return tokenResponse.data ?? null;
  } catch (err) {
    if (__DEV__) {
      // Push token retrieval frequently fails in Expo Go and on simulators.
      console.warn("[PushNotifications] failed to get expo push token", err);
    }
    return null;
  }
};

const attachResponseListener = () => {
  if (responseSubscription) return;
  responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
      deeplink?: NotificationDeeplink;
    } | null;
    const deeplink = data?.deeplink;
    if (deeplink?.screen) {
      navigate(deeplink.screen as never, (deeplink.params ?? undefined) as never);
    }
  });
};

const attachReceivedListener = () => {
  if (receivedSubscription) return;
  // Realtime store updates handle in-app state already; this hook is a placeholder
  // for future in-app banner UI. We keep the listener attached to prevent the OS
  // from dropping the foreground delivery.
  receivedSubscription = Notifications.addNotificationReceivedListener(() => undefined);
};

export const PushNotificationsService = {
  async bootstrap({ userId, pushEnabled }: PushBootstrapInput): Promise<Notifications.PermissionStatus | "web"> {
    if (Platform.OS === "web") return "web";
    ensureForegroundHandler();
    attachResponseListener();
    attachReceivedListener();
    await ensureAndroidChannel();

    if (!pushEnabled) {
      // If store says it's off, we don't attempt to register.
      return Notifications.PermissionStatus.DENIED;
    }

    const { status } = await Notifications.getPermissionsAsync();
    
    // If the OS says they haven't explicitly granted it, we return early
    // and let the soft prompt UI ask them.
    if (status !== Notifications.PermissionStatus.GRANTED) {
      return status;
    }

    const token = await getExpoToken();
    if (!token) return status;

    if (token === lastRegisteredToken) return status;
    try {
      await PushTokenService.upsert({ userId, token });
      lastRegisteredToken = token;
    } catch (err) {
      if (__DEV__) {
        console.warn("[PushNotifications] failed to upsert token", err);
      }
    }
    
    return status;
  },

  async promptForPermission(userId: string): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return false;

    const token = await getExpoToken();
    if (!token) return true; // Permission granted, but token failed (will retry on next boot)

    try {
      await PushTokenService.upsert({ userId, token });
      lastRegisteredToken = token;
    } catch (err) {
      if (__DEV__) {
        console.warn("[PushNotifications] failed to upsert token after explicit prompt", err);
      }
    }
    return true;
  },

  teardown(): void {
    responseSubscription?.remove();
    receivedSubscription?.remove();
    responseSubscription = null;
    receivedSubscription = null;
    lastRegisteredToken = null;
  },
};
