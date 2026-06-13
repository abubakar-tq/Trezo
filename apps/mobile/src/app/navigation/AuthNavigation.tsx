import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { useAppTheme } from "@theme";

import DevicePairingService from "@/src/features/wallet/services/DevicePairingService";
import { AuthStackParamList } from "@/src/types/navigation";
import {
    AuthResultScreen,
    ForgotPasswordScreen,
    LoginScreen,
    OnboardingScreen,
    RegisterScreen,
    ResetPasswordScreen,
    SplashScreen,
    VerifyEmailScreen,
} from "@features/auth";
import { LinkDeviceScreen } from "@features/auth/screens/LinkDeviceScreen";

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigation = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [initialRouteName, setInitialRouteName] = useState<keyof AuthStackParamList>("Onboarding");

  useEffect(() => {
    let cancelled = false;

    DevicePairingService.getPendingDeepLink()
      .then((pending: unknown) => {
        if (cancelled) return;
        if (pending) {
          setInitialRouteName("Login");
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
		<Stack.Navigator
			initialRouteName={initialRouteName}
			screenOptions={{
				headerShown: false,
				animation: "slide_from_right",
				gestureEnabled: true,
				gestureDirection: "horizontal",
				contentStyle: { backgroundColor: colors.background },
				animationTypeForReplace: "push",
			}}
		>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
		<Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
		<Stack.Screen name="AuthResult" component={AuthResultScreen} />
      <Stack.Screen name="LinkDevice" component={LinkDeviceScreen} />
	</Stack.Navigator>
  );
};

export default AuthNavigation;