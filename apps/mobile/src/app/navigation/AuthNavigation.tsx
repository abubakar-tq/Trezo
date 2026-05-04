import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";

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

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigation = () => {
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
				contentStyle: { backgroundColor: "#000000" },
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
	</Stack.Navigator>
  );
};

export default AuthNavigation;