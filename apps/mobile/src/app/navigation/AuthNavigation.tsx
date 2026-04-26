import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

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
import { useUserStore } from "@store/useUserStore";
import { useAppLockStore } from "@store/useAppLockStore";
import { CommonActions } from "@react-navigation/native";

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigation = () => {
  console.log('🔐 [AuthNavigation] Rendering');

  return (
		<Stack.Navigator
			initialRouteName="Onboarding"
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
	  	name="Onboarding" 
	  	component={OnboardingScreen}
	  	listeners={{ focus: () => console.log('👀 [AuthNav] Onboarding focused') }}
	  />
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