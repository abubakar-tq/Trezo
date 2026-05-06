import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";

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
import NotificationCenterScreen from "@features/notifications/screens/NotificationCenterScreen";
import NotificationSettingsScreen from "@features/profile/screens/NotificationSettingsScreen";
import PairDeviceScreen from "@features/profile/screens/PairDeviceScreen";
import ProfileEditScreen from "@features/profile/screens/ProfileEditScreen";
import RecoveryKitExportScreen from "@features/profile/screens/RecoveryKitExportScreen";
import SecurityPrivacyScreen from "@features/profile/screens/SecurityPrivacyScreen";
import AddGuardianScreen from "@features/recovery/screens/AddGuardianScreen";
import CreateRecoveryRequestScreen from "@features/recovery/screens/CreateRecoveryRequestScreen";
import GuardianManagementScreen from "@features/recovery/screens/GuardianManagementScreen";
import RecoveryCompleteScreen from "@features/recovery/screens/RecoveryCompleteScreen";
import RecoveryEntryScreen from "@features/recovery/screens/RecoveryEntryScreen";
import RecoveryProgressScreen from "@features/recovery/screens/RecoveryProgressScreen";
import SecurityCenterScreen from "@features/recovery/screens/SecurityCenterScreen";
import ShareRecoveryScreen from "@features/recovery/screens/ShareRecoveryScreen";
import ThresholdConfigurationScreen from "@features/recovery/screens/ThresholdConfigurationScreen";
import SettingsScreen from "@features/settings/screens/SettingsScreen";
import TransactionDetailScreen from "@features/transactions/screens/TransactionDetailScreen";
import TransactionHistoryScreen from "@features/transactions/screens/TransactionHistoryScreen";
import TransactionStatusScreen from "@features/transactions/screens/TransactionStatusScreen";
import AATestScreen from "@features/wallet/screens/AATestScreen";
import AAWalletDebugScreen from "@features/wallet/screens/AAWalletDebugScreen";
import BuyScreen from "@features/wallet/screens/BuyScreen";
import DeployAccountScreen from "@features/wallet/screens/DeployAccountScreen";
import DevCreateAccountScreen from "@features/wallet/screens/DevCreateAccountScreen";
import ReceiveScreen from "@features/wallet/screens/ReceiveScreen";
import SendScreen from "@features/wallet/screens/SendScreen";
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
  const splashTarget = isLoggedIn ? "DeviceVerification" : "AuthNavigation";
  // Keep a ref so the timer callback always reads the latest value without
  // being a dependency (which would cancel + restart the timer on every auth event).
  const splashTargetRef = useRef(splashTarget);
  useEffect(() => {
    splashTargetRef.current = splashTarget;
  }, [splashTarget]);

  useEffect(() => {
    setGuardNavigation(isLoggedIn);
  }, [isLoggedIn, setGuardNavigation]);

  useEffect(() => {
    // Fire once on mount. splashTargetRef is read at fire time so it always
    // reflects the settled auth state, even if isLoggedIn changed mid-timer.
    const timer = setTimeout(() => {
      setShowingSplash(false);
      if (navigationRef.isReady()) {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: splashTargetRef.current }],
        });
      }
    }, 2500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={theme.navigation}
    >
      <Stack.Navigator
        initialRouteName="AppSplash"
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
          gestureDirection: "horizontal",
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen
          name="AppSplash"
          component={SplashScreen}
          initialParams={{ redirectTo: { name: splashTarget } }}
        />
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
          component={NotificationCenterScreen}
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="NotificationSettings"
          component={NotificationSettingsScreen}
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
          name="Buy"
          component={BuyScreen}
          options={{ headerShown: false, animation: "slide_from_bottom" }}
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
        <Stack.Screen
          name="TransactionStatus"
          component={TransactionStatusScreen}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="TransactionDetail"
          component={TransactionDetailScreen}
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigation;
