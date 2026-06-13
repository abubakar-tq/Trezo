/**
 * ChainSwitcherChip
 *
 * Header chip that displays the active chain (env-tinted dot + display name)
 * and opens NetworkPickerModal on tap so the user can switch chains.
 *
 * Uses `useChainSwitcher` to do the actual switching - re-fetching the user's
 * smart-account row for the new chain so isActiveOnChain stays per-chain
 * truthful for the BalanceCard and the rest of the Home/Portfolio UI.
 */

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { NetworkPickerModal } from "@shared/components/modals/NetworkPickerModal";
import { useAppTheme, type ThemeColors } from "@theme";
import { useChainSwitcher } from "@features/wallet/hooks/useChainSwitcher";

type ChainSwitcherChipProps = {
  /** Called on successful switch — usually a toast trigger. */
  onSwitched?: (displayName: string) => void;
  /** Called on switch failure — usually a toast trigger. */
  onError?: (message: string) => void;
};

const environmentColor = (env: string | undefined, colors: ThemeColors): string => {
  if (env === "mainnet") return colors.accent;
  if (env === "local_fork") return "#F59E0B";
  if (env === "testnet") return "#A78BFA";
  return colors.success; // "local" / "anvil"
};

export const ChainSwitcherChip: React.FC<ChainSwitcherChipProps> = ({ onSwitched, onError }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [isPickerOpen, setPickerOpen] = useState(false);

  const { activeNetwork, switching, switchChain } = useChainSwitcher({
    onSuccess: (next) => onSwitched?.(next.displayName),
    onError: (message) => onError?.(message),
  });

  const envColor = environmentColor(activeNetwork?.environment, colors);
  const label = activeNetwork?.displayName ?? "Pick chain";

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Active chain: ${label}. Tap to switch.`}
        onPress={() => setPickerOpen(true)}
        disabled={switching}
        activeOpacity={0.7}
        style={[
          styles.chip,
          {
            backgroundColor: `${envColor}1A`,
            borderColor: `${envColor}47`,
            opacity: switching ? 0.6 : 1,
          },
        ]}
      >
        {switching ? (
          <ActivityIndicator size="small" color={envColor} />
        ) : (
          <View style={[styles.dot, { backgroundColor: envColor }]} />
        )}
        <Text style={[styles.label, { color: envColor }]} numberOfLines={1}>
          {label}
        </Text>
        <Feather name="chevron-down" size={10} color={envColor} />
      </TouchableOpacity>

      <NetworkPickerModal
        isVisible={isPickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedNetworkId={activeNetwork ? String(activeNetwork.chainId) : undefined}
        onSelect={(picked) => {
          setPickerOpen(false);
          if (activeNetwork && picked.chainId === activeNetwork.chainId) return;
          void switchChain(picked.chainId);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 160,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
