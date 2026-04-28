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
import ConnectedDevicesScreen from "@features/profile/screens/ConnectedDevicesScreen";
import EmailRecoveryScreen from "@features/profile/screens/EmailRecoveryScreen";
import GuardianRecoveryScreen from "@features/profile/screens/GuardianRecoveryScreen";
import NotificationsScreen from "@features/profile/screens/NotificationsScreen";
import ProfileEditScreen from "@features/profile/screens/ProfileEditScreen";
import RecoveryKitExportScreen from "@features/profile/screens/RecoveryKitExportScreen";
import SecurityPrivacyScreen from "@features/profile/screens/SecurityPrivacyScreen";
import AATestScreen from "@features/wallet/screens/AATestScreen";
import AAWalletDebugScreen from "@features/wallet/screens/AAWalletDebugScreen";
import DeployAccountScreen from "@features/wallet/screens/DeployAccountScreen";
import DevCreateAccountScreen from "@features/wallet/screens/DevCreateAccountScreen";
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
  const [initialAuthState] = useState(isLoggedIn);

  console.log(
    "🔄 [RootNavigation] Rendering, isLoggedIn:",
    isLoggedIn,
    "showingSplash:",
    showingSplash,
  );

  // Set guard navigation based on initial auth state
  useEffect(() => {
    // If user is logged in, require device verification
    // If not logged in, don't guard navigation
    setGuardNavigation(initialAuthState);
  }, [initialAuthState, setGuardNavigation]);

  // Ensure splash shows for minimum duration
  useEffect(() => {
    console.log("⏱️ [RootNavigation] Starting splash timer");
    const timer = setTimeout(() => {
      console.log("✅ [RootNavigation] Splash complete, hiding splash");
      setShowingSplash(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Determine the redirect target after splash
  const getRedirectTarget = () => {
    console.log(
      "🎯 [RootNavigation] Getting redirect target, isLoggedIn:",
      initialAuthState,
    );
    if (!initialAuthState) {
      // User not logged in - go to Auth stack
      console.log(
        "👤 [RootNavigation] User not logged in, showing AuthNavigation",
      );
      return null;
    }

    // User is logged in - show device verification screen
    console.log(
      "🔒 [RootNavigation] User logged in, redirecting to DeviceVerification",
    );
    return "DeviceVerification";
  };

  const splashKey = initialAuthState ? "tabs" : "auth";
  const redirectTarget = getRedirectTarget();

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
        initialRouteName={
          showingSplash
            ? "AppSplash"
            : initialAuthState
              ? "DeviceVerification"
              : "AuthNavigation"
        }
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
            key={splashKey}
            name="AppSplash"
            component={SplashScreen}
            initialParams={{
              redirectTo: redirectTarget ? { name: redirectTarget } : undefined,
            }}
            listeners={{
              focus: () => console.log("👀 [Navigation] AppSplash focused"),
              blur: () => console.log("👋 [Navigation] AppSplash blurred"),
            }}
          />
        ) : (
          <>
            {initialAuthState && (
              <Stack.Screen
                name="DeviceVerification"
                component={DeviceVerificationScreen}
                listeners={{
                  focus: () =>
                    console.log("👀 [Navigation] DeviceVerification focused"),
                }}
              />
            )}
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigation;
