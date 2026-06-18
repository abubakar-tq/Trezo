import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TokenIcon } from "@shared/components";
import { SetUpWalletSheet } from "@features/wallet/components/SetUpWalletSheet";
import { useSetUpWalletSheet } from "@features/wallet/hooks/useSetUpWalletSheet";
import { useAccountState } from "@features/wallet/hooks/useAccountState";
import { getEnabledChains } from "@/src/integration/chains";
import type { RootStackParamList } from "@/src/types/navigation";
import { useAppTheme } from "@theme";
import React, { useState, useMemo } from "react";
import {
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const H_PAD = 20;
const COL_GAP = 14;

function chainIconUrl(chainId: number): string | undefined {
  switch (chainId) {
    case 1:        return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";
    case 11155111: return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";
    case 137:      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png";
    case 42161:    return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png";
    case 10:       return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png";
    case 8453:     return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png";
    case 84532:    return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png";
    case 534352:   return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/scroll/info/logo.png";
    case 324:      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/zksync/info/logo.png";
    default:       return undefined;
  }
}

function chainColor(chainId: number): string {
  switch (chainId) {
    case 1:        return "#627EEA";
    case 11155111: return "#627EEA";
    case 137:      return "#8247E5";
    case 42161:    return "#28A0F0";
    case 10:       return "#FF0420";
    case 8453:     return "#0052FF";
    case 84532:    return "#0052FF";
    case 534352:   return "#E8A87C";
    case 324:      return "#8C8DFC";
    case 300:      return "#8C8DFC";
    case 31337:    return "#4f46e5";
    default:       return "#888888";
  }
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type ChainCardProps = {
  item: ReturnType<typeof getEnabledChains>[number];
  colors: ReturnType<typeof import("@theme").useAppTheme>["theme"]["colors"];
  onPress: () => void;
};

function ChainCard({ item, colors, onPress }: ChainCardProps) {
  const iconUrl = chainIconUrl(item.id);
  const color = chainColor(item.id);
  const isTestnet = item.environment === "testnet";
  return (
    // Plain View holds flex:1 — Pressable fills it. Avoids Pressable flex quirks on Android.
    <View style={styles.cardOuter}>
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfaceCard,
          borderColor: colors.border,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <View style={[styles.iconZone, { backgroundColor: `${color}15` }]}>
        {iconUrl ? (
          <TokenIcon uri={iconUrl} symbol={item.name[0]} size={64} />
        ) : (
          <View style={[styles.chainIconFallback, { backgroundColor: `${color}25` }]}>
            <Text style={[styles.chainIconLetter, { color }]}>{item.name[0]}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.cardFooter}>
          <View style={[styles.badge, { backgroundColor: isTestnet ? `${colors.accent}20` : `${color}20` }]}>
            <Text style={[styles.badgeText, { color: isTestnet ? colors.accent : color }]}>
              {isTestnet ? "Testnet" : "Mainnet"}
            </Text>
          </View>
          <Feather name="chevron-right" size={14} color={colors.textSecondary} />
        </View>
      </View>
    </Pressable>
    </View>
  );
}

export const ReceiveScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const [query, setQuery] = useState("");

  const { isProvisioned } = useAccountState();
  const { ref: setUpRef, requireProvisioned } = useSetUpWalletSheet();

  const allChains = useMemo(
    () => getEnabledChains().filter((c) => c.id !== 31337),
    []
  );

  const chains = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allChains;
    return allChains.filter((c) => c.name.toLowerCase().includes(q));
  }, [allChains, query]);

  // Pair chains into rows of 2 so we control widths with flex: 1 per card
  type ChainConfig = ReturnType<typeof getEnabledChains>[number];
  const rows = useMemo(() => {
    const result: [ChainConfig, ChainConfig | null][] = [];
    for (let i = 0; i < chains.length; i += 2) {
      result.push([chains[i], chains[i + 1] ?? null]);
    }
    return result;
  }, [chains]);

  React.useEffect(() => {
    if (!isProvisioned) requireProvisioned(false, () => {});
  }, [isProvisioned, requireProvisioned]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.glass }]}
        >
          <Feather name="x" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Receive Funds</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search networks…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Feather name="x-circle" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Chain cards — manual 2-column rows so flex:1 guarantees equal widths */}
      <FlatList
        data={rows}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="wifi-off" size={28} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {query ? `No networks match "${query}"` : "No networks available."}
            </Text>
          </View>
        }
        renderItem={({ item: [left, right] }) => (
          <View style={styles.row}>
            {[left, right].map((item, idx) =>
              item == null ? (
                <View key="spacer" style={styles.cardSpacer} />
              ) : (
                <ChainCard
                  key={item.id}
                  item={item}
                  colors={colors}
                  onPress={() => navigation.navigate("ReceiveChain", { chainId: item.id })}
                />
              )
            )}
          </View>
        )}
      />

      <SetUpWalletSheet ref={setUpRef} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: H_PAD,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    padding: 0,
  },

  // Grid
  listContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 4,
    gap: COL_GAP,
  },
  row: {
    flexDirection: "row",
    gap: COL_GAP,
  },

  // cardOuter is the flex container; card is purely visual
  cardOuter: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
  },
  cardSpacer: {
    flex: 1,
  },
  iconZone: {
    height: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  chainIconFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  chainIconLetter: {
    fontSize: 26,
    fontWeight: "900",
  },
  cardContent: {
    padding: 14,
    gap: 10,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Empty
  emptyWrap: {
    alignItems: "center",
    gap: 10,
    marginTop: 48,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
  },
});

export default ReceiveScreen;
