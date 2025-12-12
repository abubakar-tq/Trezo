import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import CreateAccountDevCard from "@/src/features/wallet/components/CreateAccountDevCard";
import { DevFundingCard } from "@/src/features/wallet/components/DevFundingCard";
import { useAppTheme } from "@theme";

const DevCreateAccountScreen = () => {
  const { theme } = useAppTheme();
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.section}>
        <Text style={[styles.header, { color: theme.colors.text }]}>Dev Controls</Text>
        <Text style={[styles.subheader, { color: theme.colors.secondaryText }]}>
          Experimental tools for creating and funding smart accounts on your local dev setup.
        </Text>
      </View>
      <View style={styles.cardSpacing}>
        <CreateAccountDevCard />
      </View>
      <DevFundingCard />
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
  cardSpacing: {
    marginBottom: 16,
  },
});

export default DevCreateAccountScreen;
