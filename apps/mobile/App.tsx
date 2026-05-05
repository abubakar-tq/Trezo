import "react-native-gesture-handler";
import "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import "./src/integration/viem/polyfills";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppErrorBoundary } from "@app/components/system/AppErrorBoundary";
import LockScreen from "@app/components/system/LockScreen";
import { MissingConfigurationScreen } from "@app/components/system/MissingConfigurationScreen";
import { useAppLock, useCachedResources } from "@hooks";
import RootNavigation from "@app/navigation/RootNavigation";
import { isSupabaseConfigured, supabaseConfigIssue } from "@lib/supabase";
import { AppThemeProvider, useAppTheme } from "@theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./global.css";

const queryClient = new QueryClient();

const App = () => (
  <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <AppBootstrap />
      </AppThemeProvider>
    </QueryClientProvider>
  </SafeAreaProvider>
);

const AppBootstrap: React.FC = () => {
  const isReady = useCachedResources();
  const { theme } = useAppTheme();
  useAppLock();

  if (!isReady) {
    return (
      <View style={[styles.bootContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <MissingConfigurationScreen
        message={supabaseConfigIssue ?? "Supabase credentials are missing."}
      />
    );
  }

  return (
    <AppErrorBoundary>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.statusBarStyle} />
        <RootNavigation />
        <LockScreen />
      </View>
    </AppErrorBoundary>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bootContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
