import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import DevicePairingService from "@/src/features/wallet/services/DevicePairingService";
import { AuthStackParamList } from "@/src/types/navigation";
import {
    AuthResultScreen,
    ForgotPasswordScreen,
    IntroductionScreen,
    LoginScreen,
    RegisterScreen,
    ResetPasswordScreen,
    SplashScreen,
    VerifyEmailScreen,
    WelcomeScreen,
} from "@features/auth";

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigation = () => {
  const [initialRouteName, setInitialRouteName] = useState<keyof AuthStackParamList | null>(null);

  useEffect(() => {
    let cancelled = false;

    DevicePairingService.getPendingDeepLink()
      .then((pending) => {
        if (cancelled) return;
        setInitialRouteName(pending ? "Login" : "Introduction");
      })
      .catch(() => {
        if (cancelled) return;
        setInitialRouteName("Introduction");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  console.log('🔐 [AuthNavigation] Rendering');

  if (!initialRouteName) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000000" }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

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
	  <Stack.Screen 
	  	name="Splash" 
	  	component={SplashScreen}
	  	listeners={{ focus: () => console.log('👀 [AuthNav] Splash focused') }}
	  />
	  <Stack.Screen 
	  	name="Introduction" 
	  	component={IntroductionScreen}
	  	listeners={{ focus: () => console.log('👀 [AuthNav] Introduction focused') }}
	  />
	  <Stack.Screen name="Welcome" component={WelcomeScreen} />
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
