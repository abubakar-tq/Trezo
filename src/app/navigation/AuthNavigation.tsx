import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

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
  console.log('🔐 [AuthNavigation] Rendering');
  
  return (
		<Stack.Navigator
			initialRouteName="Introduction"
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