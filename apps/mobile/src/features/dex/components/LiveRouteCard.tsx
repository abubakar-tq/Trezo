/**
 * LiveRouteCard
 *
 * Compact route-attribution row that reads from the already-fetched swap/bridge
 * quote. No independent API call — the main quote effect in DexScreen owns the
 * data; this component just surfaces it in a polished, low-distraction way.
 *
 * Renders only on LI.FI-enabled networks (mainnet / fork). Returns null on
 * testnet so the component is invisible during testnet demos.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import type { SwapQuote } from "@/src/features/swaps/types/swap";
import type { BridgeQuote } from "@/src/features/swaps/types/bridge";
import type { NetworkKey } from "@/src/integration/networks";
import { isLifiNetwork } from "@/src/features/swaps/lifi/constants";

type Props = {
  mode: "swap" | "bridge";
  networkKey: NetworkKey;
  /** Swap quote — drives display on the swap tab. */
  quote?: SwapQuote | null;
  /** Bridge quote — drives display on the bridge tab. */
  bridgeQuote?: BridgeQuote | null;
  /** True while the parent is fetching a fresh quote. */
  loading?: boolean;
};

type RouteInfo = {
  toolName: string;
  etaSeconds: number | null;
  attribution: string;
};

function extractSwapRoute(q: SwapQuote): RouteInfo {
  const meta = q.routeMetadata ?? {};
  return {
    toolName: (meta.toolName as string) ?? (meta.tool as string) ?? "LI.FI",
    etaSeconds: typeof meta.executionDurationSec === "number" ? meta.executionDurationSec : null,
    attribution: "LI.FI",
  };
}

function extractBridgeRoute(q: BridgeQuote): RouteInfo {
  const meta = q.routeMetadata ?? {};
  const bridgeId = (meta.bridgeId as string) ?? "bridge";
  const toolName =
    bridgeId === "lifi" ? ((meta.routeLabel as string) ?? "LI.FI Bridge")
    : bridgeId === "across_v3" ? "Across V3"
    : bridgeId;
  const etaSeconds = typeof meta.etaSeconds === "number" ? meta.etaSeconds : null;
  return {
    toolName,
    etaSeconds,
    attribution: bridgeId === "across_v3" ? "Across" : "LI.FI",
  };
}

export const LiveRouteCard: React.FC<Props> = ({ mode, networkKey, quote, bridgeQuote, loading }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  if (!isLifiNetwork(networkKey)) return null;

  const route: RouteInfo | null =
    mode === "swap" && quote ? extractSwapRoute(quote)
    : mode === "bridge" && bridgeQuote ? extractBridgeRoute(bridgeQuote)
    : null;

  if (!route && !loading) return null;

  return (
    <View style={[styles.row, { backgroundColor: colors.glass, borderColor: colors.borderMuted }]}>
      <View style={styles.left}>
        <Feather name="zap" size={11} color={colors.accent} />
        {loading && !route ? (
          <ActivityIndicator size="small" color={colors.textMuted} style={styles.spinner} />
        ) : route ? (
          <>
            <Text style={[styles.via, { color: colors.textSecondary }]}>
              via{" "}
              <Text style={[styles.toolName, { color: colors.textPrimary }]}>
                {route.toolName}
              </Text>
            </Text>
            {route.etaSeconds != null && (
              <View style={[styles.etaPill, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.etaText, { color: colors.accent }]}>
                  ~{route.etaSeconds}s
                </Text>
              </View>
            )}
          </>
        ) : null}
      </View>

      <View style={styles.right}>
        {loading && route && (
          <ActivityIndicator size="small" color={colors.textMuted} style={styles.spinner} />
        )}
        <Text style={[styles.attribution, { color: colors.textMuted }]}>
          {route?.attribution ?? "LI.FI"}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  spinner: {
    marginLeft: 2,
  },
  via: {
    fontSize: 12,
    letterSpacing: 0.1,
  },
  toolName: {
    fontSize: 12,
    fontWeight: "700",
  },
  etaPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  etaText: {
    fontSize: 11,
    fontWeight: "600",
  },
  attribution: {
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: "600",
  },
});
