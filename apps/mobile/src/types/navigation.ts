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
  PasskeyRegistration: undefined;
  Login: { email?: string; pairingMode?: "resume" } | undefined;
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
  BackupRecovery: undefined;
  DevicesPasskeys: undefined;
  PairDevice: { requestId?: string; secret?: string } | undefined;
  CompromisedWallet: undefined;
  GuardianRecovery: undefined;
  EmailRecovery: undefined;
  RecoveryEntry: undefined;
  CreateRecoveryRequest: { walletAddress?: string } | undefined;
  ShareRecoveryRequest: { requestId: string };
  RecoveryProgress: { requestId: string };
  RecoveryComplete: { requestId: string };
  RecoveryKitExport: {
    vaultKey: string;
    smartAccountAddress: string;
  };
  ProfileEdit: undefined;
  ContactList: undefined;
  AddContact: undefined;
  ContactDetail: { contactId: string };
  AATest: undefined;
  AADebug: undefined;
  DeployAccount: undefined;
  DevCreateAccount: undefined;
};

// Combined Navigation Types for convenience
export type AllNavigationParamList = AuthStackParamList & TabStackParamList & RootStackParamList;
