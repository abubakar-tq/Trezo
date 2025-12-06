/**
 * Navigation Type Definitions
 * Centralized type definitions for all navigation stacks
 */

// Auth Stack Navigation Types
export type AuthVerificationFlow = "register" | "reset";

export type AuthStackParamList = {
  Splash: { redirectTo?: { name: string; params?: Record<string, unknown> } } | undefined;
  Introduction: undefined;
  Welcome: undefined;
  Login: { email?: string } | undefined;
  Register: { email?: string } | undefined;
  ForgotPassword: { email?: string } | undefined;
  VerifyEmail: { email: string; flow: AuthVerificationFlow };
  ResetPassword: { email: string; flow: AuthVerificationFlow };
  AuthResult: { type: "account-created" | "password-updated"; email: string };
};

// Main Tab Navigation Types
export type TabStackParamList = {
  Home: undefined;
  Browser: undefined;
  Portfolio: undefined;
  Dex: undefined;
  Profile: undefined;
};

// Root Navigation Types
export type RootStackParamList = {
  AppSplash: { redirectTo?: { name: string; params?: Record<string, unknown> } } | undefined;
  DeviceVerification: undefined;
  AuthNavigation: undefined;
  TabNavigation: undefined;
  BrowserSettings: undefined;
  AATest: undefined;
  AADebug: undefined;
  DeployAccount: undefined;
};

// Combined Navigation Types for convenience
export type AllNavigationParamList = AuthStackParamList & TabStackParamList & RootStackParamList;