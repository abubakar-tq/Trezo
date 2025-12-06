import "react-native-gesture-handler";
import "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, StyleSheet, View,Text } from "react-native";
import "react-native-get-random-values";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppErrorBoundary } from "@app/components/system/AppErrorBoundary";
import LockScreen from "@app/components/system/LockScreen";
import { MissingConfigurationScreen } from "@app/components/system/MissingConfigurationScreen";
import { useAppLock, useCachedResources } from "@app/hooks";
import RootNavigation from "@app/navigation/RootNavigation";
import { isSupabaseConfigured, supabaseConfigIssue } from "@lib/supabase";
import { AppThemeProvider, useAppTheme } from "@theme";
import "./global.css";

const App = () => (
  <SafeAreaProvider>
    <AppThemeProvider>
      <AppBootstrap />
    </AppThemeProvider>
  </SafeAreaProvider>
);

const AppBootstrap: React.FC = () => {
  const isReady = useCachedResources();
  const { theme } = useAppTheme();
  useAppLock();

  console.log('🚀 [AppBootstrap] Rendering, isReady:', isReady);

  if (!isReady) {
    console.log('⏳ [AppBootstrap] Resources not ready, showing loading screen');
    return (
      <View style={[styles.bootContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  console.log('✅ [AppBootstrap] Resources ready, checking Supabase config');

  if (!isSupabaseConfigured) {
    console.log('❌ [AppBootstrap] Supabase not configured:', supabaseConfigIssue);
    return (
      <MissingConfigurationScreen
        message={supabaseConfigIssue ?? "Supabase credentials are missing."}
      />
    );
  }

  console.log('✅ [AppBootstrap] Everything ready, rendering app');

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
