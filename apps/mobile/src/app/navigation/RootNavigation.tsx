import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";

import { RootStackParamList } from "@/src/types/navigation";
import { navigationRef } from "@app/navigation/navigationRef";
import { DeviceVerificationScreen, SplashScreen } from "@features/auth";
import AddContactScreen from "@features/contacts/screens/AddContactScreen";
import ContactDetailScreen from "@features/contacts/screens/ContactDetailScreen";
import ContactListScreen from "@features/contacts/screens/ContactListScreen";
import BackupRecoveryScreen from "@features/profile/screens/BackupRecoveryScreen";
import BrowserSettingsScreen from "@features/profile/screens/BrowserSettingsScreen";
import CompromisedWalletScreen from "@features/profile/screens/CompromisedWalletScreen";
import ConnectedDevicesScreen from "@features/profile/screens/ConnectedDevicesScreen";
import DevicesPasskeysScreen from "@features/profile/screens/DevicesPasskeysScreen";
import EmailRecoveryScreen from "@features/profile/screens/EmailRecoveryScreen";
import EmailRecoveryGroupStatusScreen from "@features/profile/screens/EmailRecoveryGroupStatusScreen";
import EmailRecoveryStartScreen from "@features/profile/screens/EmailRecoveryStartScreen";
import GuardianRecoveryScreen from "@features/profile/screens/GuardianRecoveryScreen";
import NotificationsScreen from "@features/profile/screens/NotificationsScreen";
import PairDeviceScreen from "@features/profile/screens/PairDeviceScreen";
import ProfileEditScreen from "@features/profile/screens/ProfileEditScreen";
import RecoveryKitExportScreen from "@features/profile/screens/RecoveryKitExportScreen";
import SecurityPrivacyScreen from "@features/profile/screens/SecurityPrivacyScreen";
import CreateRecoveryRequestScreen from "@features/recovery/screens/CreateRecoveryRequestScreen";
import RecoveryCompleteScreen from "@features/recovery/screens/RecoveryCompleteScreen";
import RecoveryEntryScreen from "@features/recovery/screens/RecoveryEntryScreen";
import RecoveryProgressScreen from "@features/recovery/screens/RecoveryProgressScreen";
import ShareRecoveryScreen from "@features/recovery/screens/ShareRecoveryScreen";
import AATestScreen from "@features/wallet/screens/AATestScreen";
import AAWalletDebugScreen from "@features/wallet/screens/AAWalletDebugScreen";
import DeployAccountScreen from "@features/wallet/screens/DeployAccountScreen";
import DevCreateAccountScreen from "@features/wallet/screens/DevCreateAccountScreen";
import AddGuardianScreen from "@features/recovery/screens/AddGuardianScreen";
import GuardianManagementScreen from "@features/recovery/screens/GuardianManagementScreen";
import SecurityCenterScreen from "@features/recovery/screens/SecurityCenterScreen";
import ThresholdConfigurationScreen from "@features/recovery/screens/ThresholdConfigurationScreen";
import SettingsScreen from "@features/settings/screens/SettingsScreen";
import ReceiveScreen from "@features/wallet/screens/ReceiveScreen";
import SendScreen from "@features/wallet/screens/SendScreen";
import TransactionHistoryScreen from "@features/wallet/screens/TransactionHistoryScreen";
import { useAuthFlowStore } from "@store/useAuthFlowStore";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import AuthNavigation from "./AuthNavigation";
import TabNavigation from "./TabNavigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigation = () => {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const setGuardNavigation = useAuthFlowStore(
    (state) => state.setGuardNavigation,
  );
  const { theme } = useAppTheme();
  const [showingSplash, setShowingSplash] = useState(true);

  console.log(
    "🔄 [RootNavigation] Rendering, isLoggedIn:",
    isLoggedIn,
    "showingSplash:",
    showingSplash,
  );

  useEffect(() => {
    setGuardNavigation(isLoggedIn);
  }, [isLoggedIn, setGuardNavigation]);

  useEffect(() => {
    console.log("⏱️ [RootNavigation] Starting splash timer");
    const timer = setTimeout(() => {
      console.log("✅ [RootNavigation] Splash complete, hiding splash");
      setShowingSplash(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const initialRouteName = showingSplash
    ? "AppSplash"
    : isLoggedIn
      ? "DeviceVerification"
      : "AuthNavigation";

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={theme.navigation}
      onReady={() => console.log("✅ [Navigation] NavigationContainer ready")}
      onStateChange={(state) =>
        console.log(
          "📍 [Navigation] State changed:",
          JSON.stringify(state?.routes[state.index], null, 2),
        )
      }
    >
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
          gestureDirection: "horizontal",
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {showingSplash ? (
          <Stack.Screen
            name="AppSplash"
            component={SplashScreen}
          />
        ) : (
          <>
            <Stack.Screen
              name="DeviceVerification"
              component={DeviceVerificationScreen}
              listeners={{
                focus: () =>
                  console.log("👀 [Navigation] DeviceVerification focused"),
              }}
            />
            <Stack.Screen
              name="AuthNavigation"
              component={AuthNavigation}
              listeners={{
                focus: () =>
                  console.log("👀 [Navigation] AuthNavigation focused"),
              }}
            />
            <Stack.Screen
              name="TabNavigation"
              component={TabNavigation}
              listeners={{
                focus: () =>
                  console.log("👀 [Navigation] TabNavigation focused"),
              }}
            />
            <Stack.Screen
              name="BrowserSettings"
              component={BrowserSettingsScreen}
              options={{
                headerShown: true,
                headerTitle: "Browser",
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="BackupRecovery"
              component={BackupRecoveryScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="DevicesPasskeys"
              component={DevicesPasskeysScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="PairDevice"
              component={PairDeviceScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="CompromisedWallet"
              component={CompromisedWalletScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="GuardianRecovery"
              component={GuardianRecoveryScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="EmailRecovery"
              component={EmailRecoveryScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="EmailRecoveryStart"
              component={EmailRecoveryStartScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="EmailRecoveryGroupStatus"
              component={EmailRecoveryGroupStatusScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="RecoveryEntry"
              component={RecoveryEntryScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="CreateRecoveryRequest"
              component={CreateRecoveryRequestScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="ShareRecoveryRequest"
              component={ShareRecoveryScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="RecoveryProgress"
              component={RecoveryProgressScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="RecoveryComplete"
              component={RecoveryCompleteScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="RecoveryKitExport"
              component={RecoveryKitExportScreen}
              options={{
                headerShown: true,
                headerTitle: "Recovery Kit",
                animation: "slide_from_right",
                headerStyle: { backgroundColor: theme.colors.background },
                headerTintColor: theme.colors.text,
              }}
            />
            <Stack.Screen
              name="ProfileEdit"
              component={ProfileEditScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="ContactList"
              component={ContactListScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="AddContact"
              component={AddContactScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="ContactDetail"
              component={ContactDetailScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="SecurityPrivacy"
              component={SecurityPrivacyScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="ConnectedDevices"
              component={ConnectedDevicesScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="AATest"
              component={AATestScreen}
              options={{
                headerShown: true,
                headerTitle: "AA Wallet Testing",
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="AADebug"
              component={AAWalletDebugScreen}
              options={{
                headerShown: true,
                headerTitle: "AA Wallet Debug",
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="DeployAccount"
              component={DeployAccountScreen}
              options={{
                headerShown: true,
                headerTitle: "Deploy Account",
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="DevCreateAccount"
              component={DevCreateAccountScreen}
              options={{
                headerShown: true,
                headerTitle: "Dev Controls",
                animation: "slide_from_right",
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="AddGuardian"
              component={AddGuardianScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="GuardianManagement"
              component={GuardianManagementScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="SecurityCenter"
              component={SecurityCenterScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="ThresholdConfiguration"
              component={ThresholdConfigurationScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="Receive"
              component={ReceiveScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="Send"
              component={SendScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="TransactionHistory"
              component={TransactionHistoryScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigation;
