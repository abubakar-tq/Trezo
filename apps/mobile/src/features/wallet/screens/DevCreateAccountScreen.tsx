import React from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { useDevSettingsStore } from "@store/useDevSettingsStore";
import CreateAccountDevCard from "@/src/features/wallet/components/CreateAccountDevCard";
import { DevFundingCard } from "@/src/features/wallet/components/DevFundingCard";
import { PasskeyVerifyCard } from "@/src/features/wallet/components/PasskeyVerifyCard";
import { RestoreOnChainPasskeyCard } from "@/src/features/wallet/components/RestoreOnChainPasskeyCard";
import {
  ClearStaleRecoveryRowsCard,
  ForceCompleteCard,
  RelayerHealthCard,
} from "@/src/features/wallet/components/RecoveryAttemptDevCards";
import { useAppTheme } from "@theme";

const DevCreateAccountScreen = () => {
  const { theme } = useAppTheme();
  const allowShortRecoveryDelays = useDevSettingsStore(
    (state) => state.allowShortRecoveryDelays,
  );
  const setAllowShortRecoveryDelays = useDevSettingsStore(
    (state) => state.setAllowShortRecoveryDelays,
  );
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.section}>
        <Text style={[styles.header, { color: theme.colors.text }]}>Dev Controls</Text>
        <Text style={[styles.subheader, { color: theme.colors.textSecondary }]}>
          Experimental tools for creating and funding smart accounts on your local dev setup.
        </Text>
      </View>
      <View
        style={[
          styles.toggleCard,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={styles.toggleTextCol}>
          <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>
            Allow short recovery delays
          </Text>
          <Text style={[styles.toggleDesc, { color: theme.colors.textSecondary }]}>
            Adds 5m / 30m / 1h safety-delay options in Email Recovery setup so the
            execute step can be tested without waiting out a 24–48h delay.
          </Text>
        </View>
        <Switch
          value={allowShortRecoveryDelays}
          onValueChange={setAllowShortRecoveryDelays}
          trackColor={{
            false: `${theme.colors.textMuted}33`,
            true: theme.colors.accent,
          }}
          thumbColor="#ffffff"
        />
      </View>
      <View style={styles.cardSpacing}>
        <CreateAccountDevCard />
      </View>
      <DevFundingCard />
      <View style={styles.cardSpacing}>
        <PasskeyVerifyCard />
      </View>
      <View style={styles.cardSpacing}>
        <RestoreOnChainPasskeyCard />
      </View>
      {/* Recovery Attempt dev tools — Phase 4.6 */}
      <RelayerHealthCard />
      <ForceCompleteCard />
      <ClearStaleRecoveryRowsCard />
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
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  toggleTextCol: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  toggleDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
});

export default DevCreateAccountScreen;
