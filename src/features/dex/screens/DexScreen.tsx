import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import {
    ThemedAlert,
    type ThemedAlertButton,
} from "@/src/shared/components/ui";
import { useTabContentBottomInset } from "@app/hooks";
import { Ionicons } from "@expo/vector-icons";
import { TabScreenContainer } from "@shared/components";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

// Token type with EVM-compatible addresses
type Token = {
  symbol: string;
  name: string;
  icon: string;
  color: string;
  balance: string;
  address: string;
};

// Popular EVM tokens
const POPULAR_TOKENS: Token[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    icon: "💎",
    color: "#627EEA",
    balance: "0",
    address: "0x0000000000000000000000000000000000000000",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    icon: "💵",
    color: "#2775CA",
    balance: "0",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  {
    symbol: "USDT",
    name: "Tether",
    icon: "💲",
    color: "#26A17B",
    balance: "0",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    icon: "₿",
    color: "#F7931A",
    balance: "0",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    icon: "◈",
    color: "#F4B731",
    balance: "0",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    icon: "⛓️",
    color: "#2A5ADA",
    balance: "0",
    address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  },
];

export const DexScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const contentBottomInset = useTabContentBottomInset();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Token selection
  const [fromToken, setFromToken] = useState<Token>(POPULAR_TOKENS[0]);
  const [toToken, setToToken] = useState<Token>(POPULAR_TOKENS[1]);

  // Amounts
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");

  // UI states
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [customSlippage, setCustomSlippage] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [selectingToken, setSelectingToken] = useState<"from" | "to">("from");

  // Get portfolio balance
  const { activeAccount } = useWalletStore();
  const ethBalance = activeAccount?.address ? "0" : "0"; // Placeholder - will be replaced with actual balance logic

  // Alert state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons?: ThemedAlertButton[];
  }>({ visible: false, title: "", message: "" });

  const showAlert = (
    title: string,
    message: string,
    buttons?: ThemedAlertButton[],
  ) => {
    setAlertConfig({ visible: true, title, message, buttons });
  };

  const dismissAlert = () => {
    setAlertConfig({ visible: false, title: "", message: "" });
  };

  // Swap tokens positions
  const handleSwapTokens = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  }, [fromToken, toToken, fromAmount, toAmount]);

  // Calculate output amount (demo calculation)
  const handleFromAmountChange = (value: string) => {
    setFromAmount(value);
    if (value && !isNaN(parseFloat(value))) {
      // Mock exchange rate: 1 ETH = 1800 USDC
      const mockRate =
        fromToken.symbol === "ETH" && toToken.symbol === "USDC" ? 1800 : 0.0005;
      const calculated = parseFloat(value) * mockRate;
      // Format large numbers properly
      setToAmount(
        calculated < 1000 ? calculated.toFixed(6) : calculated.toFixed(2),
      );
    } else {
      setToAmount("");
    }
  };

  // Format number for display
  const formatNumber = (value: string): string => {
    if (!value) return "0.0";
    const num = parseFloat(value);
    if (isNaN(num)) return "0.0";
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return (num / 1000).toFixed(2) + "K";
    if (num >= 1) return num.toFixed(2);
    return num.toFixed(6);
  };

  // Execute swap (demo)
  const handleSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      showAlert("Invalid Amount", "Please enter a valid amount to swap.");
      return;
    }

    setIsSwapping(true);

    // Simulate swap transaction
    setTimeout(() => {
      setIsSwapping(false);
      showAlert(
        "Swap Successful! 🎉",
        `Swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`,
        [
          {
            text: "OK",
            onPress: () => {
              setFromAmount("");
              setToAmount("");
            },
            style: "default",
          },
        ],
      );
    }, 2000);
  };

  const exchangeRate =
    fromAmount && toAmount
      ? (parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)
      : "0";
  const priceImpact = "0.05"; // Mock price impact
  const networkFee = "0.0023 ETH"; // Mock network fee

  // Token selection handler
  const handleTokenSelect = (token: Token) => {
    if (selectingToken === "from") {
      if (token.symbol !== toToken.symbol) {
        setFromToken(token);
      }
    } else {
      if (token.symbol !== fromToken.symbol) {
        setToToken(token);
      }
    }
    setShowTokenModal(false);
  };

  const openTokenSelector = (type: "from" | "to") => {
    setSelectingToken(type);
    setShowTokenModal(true);
  };

  return (
    <TabScreenContainer style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: contentBottomInset }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Swap Tokens
          </Text>
          <TouchableOpacity
            onPress={() => setShowSettings(!showSettings)}
            style={styles.settingsButton}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Settings Panel */}
        {showSettings && (
          <View
            style={[
              styles.settingsPanel,
              { backgroundColor: colors.surfaceCard },
            ]}
          >
            <Text style={[styles.settingsTitle, { color: colors.textPrimary }]}>
              Slippage Tolerance
            </Text>
            <View style={styles.slippageRow}>
              {[0.1, 0.5, 1.0].map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setSlippage(value)}
                  style={[
                    styles.slippageButton,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                    slippage === value && {
                      backgroundColor: colors.accent,
                      borderColor: colors.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.slippageText,
                      { color: colors.textPrimary },
                      slippage === value && { color: colors.background },
                    ]}
                  >
                    {value}%
                  </Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={[
                  styles.customSlippageInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="Custom"
                placeholderTextColor={colors.textSecondary}
                value={customSlippage}
                onChangeText={setCustomSlippage}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}

        {/* Swap Card */}
        <View
          style={[styles.swapCard, { backgroundColor: colors.surfaceCard }]}
        >
          {/* From Token */}
          <View
            style={[styles.tokenInput, { backgroundColor: colors.background }]}
          >
            <View style={styles.tokenInputHeader}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                From
              </Text>
              <Text style={[styles.balance, { color: colors.textSecondary }]}>
                {fromToken.symbol === "ETH" ? ethBalance.slice(0, 8) : "0.00"}
              </Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.amountInput, { color: colors.textPrimary }]}
                placeholder="0.0"
                placeholderTextColor={colors.textSecondary}
                value={fromAmount}
                onChangeText={handleFromAmountChange}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                onPress={() => openTokenSelector("from")}
                style={[
                  styles.tokenSelector,
                  { backgroundColor: colors.surfaceCard },
                ]}
              >
                <Text style={styles.tokenIcon}>{fromToken.icon}</Text>
                <Text
                  style={[styles.tokenSymbol, { color: colors.textPrimary }]}
                >
                  {fromToken.symbol}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <Text
              style={[styles.tokenAddress, { color: colors.textSecondary }]}
            >
              {fromToken.address.slice(0, 6)}...{fromToken.address.slice(-4)}
            </Text>
          </View>

          {/* Swap Button */}
          <TouchableOpacity
            onPress={handleSwapTokens}
            style={[styles.swapIconButton, { backgroundColor: colors.accent }]}
          >
            <Ionicons
              name="swap-vertical"
              size={20}
              color={colors.background}
            />
          </TouchableOpacity>

          {/* To Token */}
          <View
            style={[styles.tokenInput, { backgroundColor: colors.background }]}
          >
            <View style={styles.tokenInputHeader}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                To
              </Text>
            </View>
            <View style={styles.inputRow}>
              <Text style={[styles.amountInput, { color: colors.textPrimary }]}>
                {formatNumber(toAmount) || "0.0"}
              </Text>
              <TouchableOpacity
                onPress={() => openTokenSelector("to")}
                style={[
                  styles.tokenSelector,
                  { backgroundColor: colors.surfaceCard },
                ]}
              >
                <Text style={styles.tokenIcon}>{toToken.icon}</Text>
                <Text
                  style={[styles.tokenSymbol, { color: colors.textPrimary }]}
                >
                  {toToken.symbol}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <Text
              style={[styles.tokenAddress, { color: colors.textSecondary }]}
            >
              {toToken.address.slice(0, 6)}...{toToken.address.slice(-4)}
            </Text>
          </View>
        </View>

        {/* Rate Card */}
        {fromAmount && toAmount && (
          <View
            style={[styles.rateCard, { backgroundColor: colors.surfaceCard }]}
          >
            <View style={styles.rateRow}>
              <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>
                Exchange Rate
              </Text>
              <Text style={[styles.rateValue, { color: colors.textPrimary }]}>
                1 {fromToken.symbol} = {exchangeRate} {toToken.symbol}
              </Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>
                Price Impact
              </Text>
              <Text style={[styles.rateValue, { color: colors.success }]}>
                ~{priceImpact}%
              </Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>
                Minimum Received
              </Text>
              <Text style={[styles.rateValue, { color: colors.textPrimary }]}>
                {formatNumber(
                  (parseFloat(toAmount) * (1 - slippage / 100)).toFixed(6),
                )}{" "}
                {toToken.symbol}
              </Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>
                Network Fee
              </Text>
              <Text style={[styles.rateValue, { color: colors.textPrimary }]}>
                {networkFee}
              </Text>
            </View>
          </View>
        )}

        {/* Swap Execute Button */}
        <TouchableOpacity
          onPress={handleSwap}
          disabled={!fromAmount || parseFloat(fromAmount) <= 0 || isSwapping}
          style={[
            styles.swapButton,
            (!fromAmount || parseFloat(fromAmount) <= 0) &&
              styles.swapButtonDisabled,
          ]}
        >
          <LinearGradient
            colors={
              !fromAmount || parseFloat(fromAmount) <= 0
                ? [colors.border, colors.border]
                : [colors.accent, colors.accent + "CC"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.swapButtonGradient}
          >
            {isSwapping ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text
                style={[styles.swapButtonText, { color: colors.background }]}
              >
                {!fromAmount || parseFloat(fromAmount) <= 0
                  ? "Enter Amount"
                  : "Swap Tokens"}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Popular Tokens */}
        <View style={styles.popularSection}>
          <Text style={[styles.popularTitle, { color: colors.textPrimary }]}>
            Popular Tokens
          </Text>
          <View style={styles.popularGrid}>
            {POPULAR_TOKENS.map((token) => (
              <TouchableOpacity
                key={token.symbol}
                style={[
                  styles.popularToken,
                  { backgroundColor: colors.surfaceCard },
                ]}
                onPress={() => {
                  if (fromToken.symbol !== token.symbol) {
                    setFromToken(token);
                  } else {
                    setToToken(token);
                  }
                }}
              >
                <View
                  style={[
                    styles.popularTokenIcon,
                    { backgroundColor: token.color + "20" },
                  ]}
                >
                  <Text style={styles.popularTokenEmoji}>{token.icon}</Text>
                </View>
                <Text
                  style={[
                    styles.popularTokenSymbol,
                    { color: colors.textPrimary },
                  ]}
                >
                  {token.symbol}
                </Text>
                <Text
                  style={[
                    styles.popularTokenBalance,
                    { color: colors.textSecondary },
                  ]}
                >
                  {token.balance}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Token Selector Modal */}
      <Modal
        visible={showTokenModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTokenModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Select Token
              </Text>
              <TouchableOpacity onPress={() => setShowTokenModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalTokenList}>
              {POPULAR_TOKENS.map((token) => (
                <TouchableOpacity
                  key={token.symbol}
                  style={[
                    styles.modalTokenItem,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => handleTokenSelect(token)}
                >
                  <View
                    style={[
                      styles.modalTokenIcon,
                      { backgroundColor: token.color + "20" },
                    ]}
                  >
                    <Text style={styles.modalTokenEmoji}>{token.icon}</Text>
                  </View>
                  <View style={styles.modalTokenInfo}>
                    <Text
                      style={[
                        styles.modalTokenSymbol,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {token.symbol}
                    </Text>
                    <Text
                      style={[
                        styles.modalTokenName,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {token.name}
                    </Text>
                  </View>
                  {token.symbol === "ETH" && (
                    <Text
                      style={[
                        styles.modalTokenBalance,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {ethBalance.slice(0, 8)}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Themed Alert */}
      <ThemedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onDismiss={dismissAlert}
      />
    </TabScreenContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      flex: 1,
      padding: 16,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
    },
    settingsButton: {
      padding: 8,
    },
    infoBanner: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
      gap: 8,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
    },
    settingsPanel: {
      padding: 16,
      borderRadius: 16,
      marginBottom: 16,
    },
    settingsTitle: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 12,
    },
    slippageRow: {
      flexDirection: "row",
      gap: 8,
    },
    slippageButton: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
      minWidth: 60,
    },
    slippageText: {
      fontSize: 14,
      fontWeight: "600",
    },
    customSlippageInput: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "600",
      minWidth: 80,
    },
    swapCard: {
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
    },
    tokenInput: {
      borderRadius: 16,
      padding: 16,
    },
    tokenInputHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: "500",
    },
    balance: {
      fontSize: 12,
    },
    inputRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    amountInput: {
      flex: 1,
      fontSize: 32,
      fontWeight: "bold",
    },
    tokenSelector: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 20,
      gap: 6,
    },
    tokenIcon: {
      fontSize: 20,
    },
    tokenSymbol: {
      fontSize: 16,
      fontWeight: "600",
    },
    tokenAddress: {
      fontSize: 11,
      fontFamily: "monospace",
    },
    swapIconButton: {
      alignSelf: "center",
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginVertical: -20,
      zIndex: 1,
    },
    rateCard: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      gap: 12,
    },
    rateRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    rateLabel: {
      fontSize: 14,
    },
    rateValue: {
      fontSize: 14,
      fontWeight: "600",
    },
    swapButton: {
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 24,
    },
    swapButtonDisabled: {
      opacity: 0.5,
    },
    swapButtonGradient: {
      paddingVertical: 18,
      alignItems: "center",
    },
    swapButtonText: {
      fontSize: 18,
      fontWeight: "bold",
    },
    popularSection: {
      marginBottom: 24,
    },
    popularTitle: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 12,
    },
    popularGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    popularToken: {
      width: "31%",
      padding: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    popularTokenIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    popularTokenEmoji: {
      fontSize: 20,
    },
    popularTokenSymbol: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 4,
    },
    popularTokenBalance: {
      fontSize: 11,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "70%",
      paddingBottom: 20,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255, 255, 255, 0.1)",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
    },
    modalTokenList: {
      paddingHorizontal: 20,
    },
    modalTokenItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      borderBottomWidth: 1,
    },
    modalTokenIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    modalTokenEmoji: {
      fontSize: 20,
    },
    modalTokenInfo: {
      flex: 1,
    },
    modalTokenSymbol: {
      fontSize: 16,
      fontWeight: "600",
    },
    modalTokenName: {
      fontSize: 12,
      marginTop: 2,
    },
    modalTokenBalance: {
      fontSize: 14,
      fontWeight: "600",
    },
  });

export default DexScreen;
