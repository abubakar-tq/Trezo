import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FontFamilies } from "@shared/components/TokenRegistry";
import {
  AccountDeploymentService,
  deriveDefaultWalletId,
} from "@features/wallet/services/AccountDeploymentService";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useUserStore } from "@store/useUserStore";
import {
  getChainConfig,
  isPortableChain,
  type SupportedChainId,
} from "@/src/integration/chains";
import type { RootStackParamList } from "@/src/types/navigation";
import { useAppTheme } from "@theme";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "ReceiveChain">;

export const ReceiveChainScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { chainId } = route.params;

  const chain = getChainConfig(chainId as SupportedChainId);

  const user = useUserStore((s) => s.user);
  const smartAccountAddress = useUserStore((s) => s.smartAccountAddress);
  const aaAccount = useWalletStore((s) => s.aaAccount);
  const passkeys = useWalletStore((s) => s.passkeys);

  const [address, setAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setResolving(true);

      // Fast path 1: aaAccount already predicted for this exact chain.
      if (aaAccount?.predictedAddress && aaAccount.chainId === chainId) {
        if (!cancelled) {
          setAddress(aaAccount.predictedAddress);
          setResolving(false);
        }
        return;
      }

      // Fast path 2: portable chain — same address across chains.
      if (isPortableChain(chainId) && aaAccount?.predictedAddress) {
        if (!cancelled) {
          setAddress(aaAccount.predictedAddress);
          setResolving(false);
        }
        return;
      }

      // Fast path 3: user store fallback (e.g. just after SetUp).
      if (smartAccountAddress) {
        if (!cancelled) {
          setAddress(smartAccountAddress);
          setResolving(false);
        }
        return;
      }

      // Slow path: derive the counterfactual address for this specific chain.
      try {
        if (!user) throw new Error("Not signed in.");
        const passkey = passkeys[0];
        if (!passkey) throw new Error("No passkey bound.");

        // Build a PasskeyMetadata-compatible object from PasskeyInfo fields.
        const passkeyMeta = {
          id: passkey.id,
          credentialId: passkey.credentialId,
          credentialIdRaw: (passkey.idRaw ?? passkey.credentialId) as `0x${string}`,
          px: passkey.px as `0x${string}` | undefined,
          py: passkey.py as `0x${string}` | undefined,
          // Sign is only needed at UA submit time — predictAddress doesn't call sign.
          sign: async () => { throw new Error("sign not available in predict-only path"); },
        } as any;

        const walletId = (
          aaAccount?.walletId ?? deriveDefaultWalletId(user.id)
        ) as `0x${string}`;
        const walletIndex = aaAccount?.walletIndex ?? 0;
        const deploymentMode =
          aaAccount?.deploymentMode ??
          (isPortableChain(chainId) ? "portable" : "chain-specific");

        const predicted = await AccountDeploymentService.predictAddress(
          walletId,
          passkeyMeta,
          chainId as SupportedChainId,
          walletIndex,
          deploymentMode,
        );
        if (!cancelled) {
          setAddress(predicted);
        }
      } catch (err) {
        console.warn("[ReceiveChainScreen] predictAddress failed:", err);
        // Leave address null — the "preparing" state will remain.
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => { cancelled = true; };
  }, [chainId, aaAccount, passkeys, smartAccountAddress, user]);

  const handleCopy = async () => {
    if (!address) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!address) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: address });
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.glass }]}
        >
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.labelKicker, { color: colors.accent }]}>RECEIVE ON</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {chain?.name ?? "Chain"}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View
        style={[
          styles.body,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {resolving ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Preparing address…
            </Text>
          </View>
        ) : address ? (
          <>
            {/* Hero QR */}
            <View style={[styles.qrCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <View style={styles.qrInner}>
                <QRCode
                  value={address}
                  size={220}
                  color="#000000"
                  backgroundColor="#FFFFFF"
                />
              </View>
              <View style={styles.qrFooter}>
                <Ionicons name="shield-checkmark" size={16} color={colors.success} />
                <Text style={[styles.qrFooterText, { color: colors.textSecondary }]}>
                  Verified Wallet Address
                </Text>
              </View>
            </View>

            {/* Address */}
            <View style={[styles.addressCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <View style={styles.addressHeader}>
                <Text style={[styles.addrLabel, { color: colors.textMuted }]}>
                  YOUR {(chain?.name ?? "CHAIN").toUpperCase()} ADDRESS
                </Text>
                <Pressable
                  onPress={handleCopy}
                  style={[styles.copyBadge, { backgroundColor: `${colors.accent}14` }]}
                >
                  <Feather
                    name={copied ? "check" : "copy"}
                    size={14}
                    color={colors.accent}
                  />
                  <Text style={[styles.copyBadgeText, { color: colors.accent }]}>
                    {copied ? "COPIED" : "COPY"}
                  </Text>
                </Pressable>
              </View>
              <Text
                style={[styles.addressText, { color: colors.textPrimary }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {address}
              </Text>
            </View>

            {/* Hint */}
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Send any token on {chain?.name ?? "this chain"} to this address.
            </Text>

            {/* Spacer: absorbs dead space so Share button anchors consistently */}
            <View style={styles.spacer} />

            {/* Share */}
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.shareBtn,
                {
                  backgroundColor: colors.accent,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather name="share-2" size={18} color={colors.textOnAccent} />
              <Text style={[styles.shareBtnText, { color: colors.textOnAccent }]}>
                Share Address
              </Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.loadingWrap}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Could not resolve address for this chain.
            </Text>
          </View>
        )}
      </View>
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
    flex: 1,
  },
  labelKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    alignItems: "center",
    gap: 20,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    textAlign: "center",
  },
  qrCard: {
    width: "100%",
    borderRadius: 32,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
  },
  qrInner: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  qrFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  qrFooterText: {
    fontSize: 13,
    fontWeight: "600",
  },
  addressCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  addrLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  copyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  copyBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
  addressText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: FontFamilies.mono,
    lineHeight: 18,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  hint: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  spacer: {
    flex: 1,
    minHeight: 8,
    maxHeight: 40,
    alignSelf: "stretch",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    height: 56,
    borderRadius: 20,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});

export default ReceiveChainScreen;
