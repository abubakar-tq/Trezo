import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import CreateAccountDevCard from "@/src/features/wallet/components/CreateAccountDevCard";
import { useAppTheme } from "@theme";

const DevCreateAccountScreen = () => {
  const { theme } = useAppTheme();
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.section}>
        <Text style={[styles.header, { color: theme.colors.text }]}>Dev: Create Account</Text>
        <Text style={[styles.subheader, { color: theme.colors.secondaryText }]}>
          Build + send a UserOp to create a SmartAccount using your device passkey (biometric prompt).
        </Text>
      </View>
      <CreateAccountDevCard />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 12,
    gap: 4,
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
  },
  subheader: {
    fontSize: 14,
  },
});

export default DevCreateAccountScreen;
