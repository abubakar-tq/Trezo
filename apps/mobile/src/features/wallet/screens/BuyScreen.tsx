/**
 * BuyScreen.tsx
 *
 * On-Ramp Buy Screen — provider-agnostic, multi-network
 *
 * Modes (set via EXPO_PUBLIC_RAMP_MODE in .env):
 *   "auto"    → chainId 31337 = mock (Anvil), else = transak
 *   "mock"    → always local Anvil (for FYP demo)
 *   "transak" → always Transak widget (testnet or mainnet)
 *
 * Flow:
 *   1. User enters USD amount + selects asset
 *   2. BuyScreen calls onramp-session edge function
 *   3a. Mock:    status card appears, "Complete Mock Order" triggers Anvil tx
 *   3b. Transak: Transak widget opens in browser, user does KYC + card
 *                Transak webhook → onramp-webhook → (hybrid) → Anvil tx
 *   4. UI polls ramp_orders table every 3s until terminal status
 */

import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountPickerModal } from "@shared/components/modals/AccountPickerModal";
import { AssetPickerModal, type Asset } from "@shared/components/modals/AssetPickerModal";
import { NetworkPickerModal, type Network } from "@shared/components/modals/NetworkPickerModal";

import { useUserStore } from "@/src/store/useUserStore";
import { useWalletStore } from "../store/useWalletStore";
import { RampService } from "@/src/services/RampService";
import { type RampOrder, type RampProvider, type TransakNetwork, TRANSAK_NETWORKS } from "@/src/types/ramp";
import { CHAIN_CONFIG } from "@/src/core/network/chain";
import { getChainConfig, getEnabledChains } from "@/src/integration/chains";

import { BuyAmountForm } from "../components/ramp/BuyAmountForm";
import { OrderStatusCard } from "../components/ramp/OrderStatusCard";
import { TransakWebViewModal } from "../components/ramp/TransakWebViewModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TERMINAL_STATUSES = ["completed", "failed", "local_mock_completed", "expired", "refunded"] as const;
const POLL_INTERVAL_MS = 3000;

function resolveProvider(rampMode: string, chainId: number): RampProvider {
  if (rampMode === "mock") return "mock";
  if (rampMode === "transak") return "transak";
  // auto mode: local Anvil → mock, everything else → transak
  return chainId === 31337 ? "mock" : "transak";
}

function estimateCrypto(fiatUsd: number, symbol: string): string {
  if (!fiatUsd || fiatUsd <= 0) return "0.0000";
  const prices: Record<string, number> = {
    ETH: 2500,
    BTC: 65000,
    USDC: 1,
    USDT: 1,
    MATIC: 0.85,
    BNB: 580,
  };
  const price = prices[symbol.toUpperCase()] ?? 2500;
  return (fiatUsd / price).toFixed(4);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export const BuyScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // ── Store access ──────────────────────────────────────────────────────────
  const smartAccountAddress = useUserStore((s) => s.smartAccountAddress);
  const aaAccount = useWalletStore((s) => s.aaAccount);
  const accounts = useWalletStore((s) => s.accounts);
  const activeAccountId = useWalletStore((s) => s.activeAccountId);
  const setActiveAccount = useWalletStore((s) => s.setActiveAccount);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];

  // The actual address we fund (priority: smart account > aaAccount predicted > EOA)
  const targetAddress = smartAccountAddress || aaAccount?.predictedAddress || activeAccount?.address || "";

  // ── Ramp mode: read from env, default to "auto" ───────────────────────────
  const rampMode = process.env.EXPO_PUBLIC_RAMP_MODE ?? "auto";

  // ── Network selection — defaults to the active wallet chain ──────────────
  // We read from walletStore.activeChainId (canonical wallet state) rather than
  // CHAIN_CONFIG.chainId (which reads EXPO_PUBLIC_DEFAULT_CHAIN_ID — inlined at
  // bundle time, so stale after .env changes until a full Metro restart).
  const walletActiveChainId = useWalletStore((s) => s.activeChainId);
  const enabledChains = useMemo(() => getEnabledChains(), []);
  const defaultChainId =
    walletActiveChainId && enabledChains.some((c) => c.id === walletActiveChainId)
      ? walletActiveChainId
      : CHAIN_CONFIG.chainId;
  const [selectedChainId, setSelectedChainId] = useState<number>(defaultChainId);
  const [isNetworkPickerOpen, setIsNetworkPickerOpen] = useState(false);

  const selectedChain = useMemo(
    () => getChainConfig(selectedChainId as any) ?? enabledChains[0],
    [selectedChainId, enabledChains]
  );

  // Provider is resolved automatically — never shown to the user
  const provider = resolveProvider(rampMode, selectedChainId);

  // ── Local state ───────────────────────────────────────────────────────────
  const [amount, setAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset>({
    symbol: "ETH",
    name: "Ethereum",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  });
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeOrder, setActiveOrder] = useState<RampOrder | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [transakUrl, setTransakUrl] = useState<string | null>(null);
  // transakNetwork is derived from selectedChainId when provider === "transak"
  const transakNetwork = useMemo<TransakNetwork>(() => {
    const entry = (Object.entries(TRANSAK_NETWORKS) as [TransakNetwork, typeof TRANSAK_NETWORKS[TransakNetwork]][])
      .find(([, cfg]) => cfg.chainId === selectedChainId);
    return entry ? entry[0] : "ethereum";
  }, [selectedChainId]);

  // Transak-supported crypto assets for the active network — replaces the user's
  // owned-tokens list so the Buy picker offers what's actually buyable.
  const [transakAssets, setTransakAssets] = useState<Asset[]>([]);
  const [transakAssetsLoading, setTransakAssetsLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setTransakAssetsLoading(true);
    void RampService.fetchTransakCryptoCurrencies({
      network: transakNetwork,
      isTestnet: selectedChain?.environment !== "mainnet",
    })
      .then((list) => {
        if (cancelled) return;
        const mapped: Asset[] = list.map((a) => ({
          symbol: a.symbol,
          name: a.name,
          logo: a.image,
          chainId: a.chainId ?? selectedChainId,
        }));
        setTransakAssets(mapped);
        // If currently-selected asset isn't in the list, default to first (usually ETH).
        if (mapped.length > 0 && !mapped.some((m) => m.symbol === selectedAsset.symbol)) {
          setSelectedAsset(mapped[0]);
        }
      })
      .finally(() => {
        if (!cancelled) setTransakAssetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [transakNetwork, selectedChain?.environment, selectedChainId, selectedAsset.symbol]);

  const QUICK_AMOUNTS = useMemo(() => ["30", "50", "100", "200"], []);

  // Derived
  const fiatAmount = parseFloat(amount || "0");
  const estimatedCrypto = useMemo(
    () => estimateCrypto(fiatAmount, selectedAsset.symbol),
    [fiatAmount, selectedAsset.symbol]
  );
  const displayAddress = targetAddress
    ? `${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}`
    : "No wallet";
  const isValidAmount = fiatAmount > 0;

  // ── Polling ───────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!isPolling || !activeOrder?.id) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const updated = await RampService.getOrder(activeOrder.id);
        setActiveOrder(updated);
        if (TERMINAL_STATUSES.includes(updated.internalStatus as any)) {
          stopPolling();
          if (updated.internalStatus === "local_mock_completed" || updated.internalStatus === "completed") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      } catch (err) {
        console.error("[BuyScreen] Polling error:", err);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isPolling, activeOrder?.id, stopPolling]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setAmount(cleaned);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBuy = async () => {
    if (!isValidAmount) return;
    if (!targetAddress) {
      Alert.alert(
        "No Wallet Found",
        "Please go to the Wallet tab and create or import a wallet first.",
        [{ text: "OK" }]
      );
      return;
    }

    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const effectiveChainId = provider === "transak"
        ? TRANSAK_NETWORKS[transakNetwork].chainId
        : selectedChainId;

      const session = await RampService.createSession({
        walletAddress: targetAddress,
        chainId: effectiveChainId,
        fiatCurrency: "USD",
        fiatAmount,
        cryptoCurrency: selectedAsset.symbol,
        provider,
        transakNetwork: provider === "transak" ? transakNetwork : undefined,
      });

      const order = await RampService.getOrder(session.orderId);
      setActiveOrder(order);
      setIsPolling(true);

      // Open widget for Transak; mock shows the status card directly
      if (session.provider === "transak" && session.widgetUrl) {
        setTransakUrl(session.widgetUrl);
      }
    } catch (err: any) {
      console.error("[BuyScreen] handleBuy error:", err);
      Alert.alert("Error", err.message ?? "Failed to create on-ramp session");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransakEvent = useCallback(async (eventId: string, data: any) => {
    if (eventId === "TRANSAK_ORDER_SUCCESSFUL") {
      setTransakUrl(null);
      try {
        if (activeOrder?.id) await RampService.notifyWebhook(activeOrder.id, data);
      } catch (err) {
        console.error("[BuyScreen] notifyWebhook error:", err);
      }
    } else if (
      eventId === "TRANSAK_ORDER_FAILED" ||
      eventId === "TRANSAK_ORDER_CANCELLED"
    ) {
      setTransakUrl(null);
      stopPolling();
      setActiveOrder(null);
    }
  }, [activeOrder?.id, stopPolling]);

  // When user closes the Transak WebView via the X button (not via a Transak event),
  // bail out cleanly: stop polling and clear the order if it never reached a terminal
  // state. Without this, the order spinner runs forever on a stuck 'created' status.
  const handleTransakClose = useCallback(() => {
    setTransakUrl(null);
    if (
      activeOrder &&
      !TERMINAL_STATUSES.includes(activeOrder.internalStatus as any)
    ) {
      stopPolling();
      setActiveOrder(null);
    }
  }, [activeOrder, stopPolling]);

  const handleCompleteMock = async () => {
    if (!activeOrder) return;
    setIsProcessing(true);
    try {
      await RampService.completeMockOrder(activeOrder.id);
      // Immediately refresh order state — don't wait for the poll tick
      const updated = await RampService.getOrder(activeOrder.id);
      setActiveOrder(updated);
      stopPolling(); // terminal state reached — stop the interval
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to complete mock order");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setActiveOrder(null);
    setAmount("");
    stopPolling();
  };

  const handleNetworkSelect = (network: Network) => {
    setSelectedChainId(network.chainId);
    setIsNetworkPickerOpen(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
          >
            <Feather name="chevron-left" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Buy Crypto</Text>
          {/* Network badge — shows chain name; tap opens network picker */}
          <TouchableOpacity
            style={[styles.networkBadge, { backgroundColor: colors.surfaceCard }]}
            onPress={() => setIsNetworkPickerOpen(true)}
          >
            <View
              style={[
                styles.networkDot,
                { backgroundColor: selectedChain?.environment === "local" ? colors.warning : colors.success },
              ]}
            />
            <Text style={[styles.networkText, { color: colors.textMuted }]}>
              {selectedChain?.name ?? "Select Network"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {!activeOrder ? (
            <BuyAmountForm
              amount={amount}
              selectedAsset={selectedAsset}
              estimatedCrypto={estimatedCrypto}
              targetAddress={targetAddress}
              displayAddress={displayAddress}
              onAmountChange={handleAmountChange}
              onAssetPress={() => setIsAssetPickerOpen(true)}
              onAccountPress={() => setIsAccountPickerOpen(true)}
              quickAmounts={QUICK_AMOUNTS}
              onQuickAmount={(v) => setAmount(v)}
              assetLoading={transakAssetsLoading}
            />
          ) : (
            <OrderStatusCard
              order={activeOrder}
              chainName={selectedChain?.name ?? "Anvil"}
              displayAddress={displayAddress}
              isProcessing={isProcessing}
              onCompleteMock={handleCompleteMock}
              onDone={handleReset}
            />
          )}
        </ScrollView>

        {/* CTA */}
        {!activeOrder && (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleBuy}
              disabled={!isValidAmount || isProcessing}
            >
              <LinearGradient
                colors={isValidAmount ? [colors.accent, colors.accent] : [colors.border, colors.border]}
                style={[styles.ctaBtn, { opacity: isValidAmount ? 1 : 0.45 }]}
              >
                {isProcessing ? (
                  <ActivityIndicator color={colors.textOnAccent} />
                ) : (
                  <>
                    <Text style={[styles.ctaBtnText, { color: colors.textOnAccent }]}>
                      Buy {selectedAsset.symbol}
                    </Text>
                    <Feather name="arrow-right" size={20} color={colors.textOnAccent} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Modals */}
      <AccountPickerModal
        isVisible={isAccountPickerOpen}
        onClose={() => setIsAccountPickerOpen(false)}
        onSelect={(acc) => {
          setActiveAccount(acc);
          setIsAccountPickerOpen(false);
        }}
        accounts={accounts}
        selectedAddress={activeAccount?.address}
      />
      <AssetPickerModal
        isVisible={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        onSelect={(asset) => {
          setSelectedAsset(asset);
          setIsAssetPickerOpen(false);
        }}
        assets={transakAssets}
        title="Select crypto to buy"
      />
      <NetworkPickerModal
        isVisible={isNetworkPickerOpen}
        onClose={() => setIsNetworkPickerOpen(false)}
        onSelect={handleNetworkSelect}
        selectedNetworkId={String(selectedChainId)}
      />

      {transakUrl && (
        <TransakWebViewModal
          visible
          url={transakUrl}
          onClose={handleTransakClose}
          onOrderEvent={handleTransakEvent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  networkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  ctaBtn: {
    height: 64,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  ctaBtnText: {
    fontSize: 18,
    fontWeight: "800",
  },
});

export default BuyScreen;
