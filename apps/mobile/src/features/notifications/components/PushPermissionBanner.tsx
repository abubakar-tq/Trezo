import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { useNotificationStore } from "@features/notifications/store/useNotificationStore";
import { PushNotificationsService } from "@features/notifications/services/PushNotificationsService";
import { useUserStore } from "@/src/store/useUserStore";
import { Ionicons } from "@expo/vector-icons";

export const PushPermissionBanner = () => {
  const userId = useUserStore((state) => state.user?.id);
  const pushEnabled = useNotificationStore((state) => state.preferences.pushEnabled);
  const savePreferences = useNotificationStore((state) => state.savePreferences);
  const [osGranted, setOsGranted] = useState<boolean | null>(null);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setOsGranted(status === "granted");
    });
  }, [pushEnabled]); // re-check when store changes

  if (!userId) return null;
  // If the user turned it on AND the OS says it's granted, hide banner
  if (pushEnabled && osGranted) return null;

  const handlePress = async () => {
    const { status } = await Notifications.getPermissionsAsync();

    if (status === "denied" && !pushEnabled) {
      // OS is permanently denying because they rejected the hard prompt before,
      // or they explicitly revoked it. We must route to settings.
      Linking.openSettings();
      return;
    }

    if (!osGranted && pushEnabled) {
      // User turned it on in app but revoked in OS settings. Deep link to settings.
      Linking.openSettings();
      return;
    }

    // Ask for permission via soft prompt
    const granted = await PushNotificationsService.promptForPermission(userId);
    setOsGranted(granted);
    if (granted) {
      await savePreferences({ pushEnabled: true });
    } else {
      // If denied, update store but still show the banner
      await savePreferences({ pushEnabled: false });
      Notifications.getPermissionsAsync().then((res) => {
         if (res.status === 'denied') {
             Linking.openSettings();
         }
      });
    }
  };

  return (
    <TouchableOpacity 
      onPress={handlePress}
      className="flex-row items-center bg-yellow-500/20 px-4 py-3 mx-4 mb-4 rounded-xl border border-yellow-500/30"
    >
      <Ionicons name="notifications-off-circle" size={24} color="#EAB308" className="mr-3" />
      <View className="flex-1 ml-3">
        <Text className="text-yellow-500 font-semibold text-sm">Enable Notifications</Text>
        <Text className="text-yellow-500/80 text-xs mt-0.5">
          Tap to get instant alerts when funds arrive.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#EAB308" />
    </TouchableOpacity>
  );
};
