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
import React, { useEffect } from "react";
import {
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Map chain ID to a TrustWallet icon URL (mirrors NetworkPickerModal). */
function chainIconUrl(chainId: number): string | undefined {
  switch (chainId) {
    case 1:        return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";
    case 11155111: return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";
    case 137:      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png";
    case 42161:    return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png";
    case 421614:   return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png";
    case 10:       return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png";
    case 8453:     return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png";
    case 84532:    return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png";
    case 534352:   return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/scroll/info/logo.png";
    case 324:      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/zksync/info/logo.png";
    default:       return undefined;
  }
}

/** Map chain ID to a brand colour for the fallback icon. */
function chainColor(chainId: number): string {
  switch (chainId) {
    case 1:        return "#627EEA";
    case 11155111: return "#627EEA";
    case 137:      return "#8247E5";
    case 42161:    return "#28A0F0";
    case 421614:   return "#28A0F0";
    case 10:       return "#FF0420";
    case 8453:     return "#0052FF";
    case 84532:    return "#0052FF";
    case 534352:   return "#FFDBB0";
    case 324:      return "#8C8DFC";
    case 300:      return "#8C8DFC";
    case 31337:    return "#4f46e5";
    default:       return "#888888";
  }
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export const ReceiveScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const { isProvisioned } = useAccountState();
  const { ref: setUpRef, requireProvisioned } = useSetUpWalletSheet();
  const chains = getEnabledChains();

  useEffect(() => {
    if (!isProvisioned) {
      requireProvisioned(false, () => {});
    }
  }, [isProvisioned, requireProvisioned]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.glass }]}
        >
          <Feather name="x" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.labelKicker, { color: colors.accent }]}>SECURE PASSAGE</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Receive Funds</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={chains}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No networks available.
          </Text>
        }
        renderItem={({ item }) => {
          const iconUrl = chainIconUrl(item.id);
          const color = chainColor(item.id);
          return (
            <Pressable
              onPress={() =>
                navigation.navigate("ReceiveChain", { chainId: item.id })
              }
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.surfaceCard,
                  borderColor: colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              {iconUrl ? (
                <TokenIcon uri={iconUrl} symbol={item.name[0]} size={36} />
              ) : (
                <View
                  style={[
                    styles.chainIconFallback,
                    { backgroundColor: `${color}22` },
                  ]}
                >
                  <Text style={[styles.chainIconLetter, { color }]}>
                    {item.name[0]}
                  </Text>
                </View>
              )}
              <Text
                style={[styles.chainName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Feather
                name="chevron-right"
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
          );
        }}
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
    paddingBottom: 20,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  labelKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  chainIconFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  chainIconLetter: {
    fontSize: 16,
    fontWeight: "900",
  },
  chainName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
});

export default ReceiveScreen;
