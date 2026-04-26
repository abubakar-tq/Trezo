/**
 * SendScreen.tsx
 *
 * Send transaction screen with lock icons and security confirmations.
 *
 * Constraints Applied:
 * - Rule of One: Single "Review & Send" primary button
 * - Trust Markers: Lock icons beside inputs and on confirm button
 * - Lock icon: For blockchain-write operations
 * - Z-Pattern: Balance top, inputs middle, action bottom
 * - Microcopy: Reassurance on delays
 * - No spinners for data (skeletons instead)
 */

import React, { useState } from "react";
import { SafeAreaView, ScrollView, View, Text, TextInput, TouchableOpacity } from "react-native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

interface SendScreenProps {
  onReviewSend?: (recipient: string, amount: string) => void;
  onCancel?: () => void;
}

export const SendScreen: React.FC<SendScreenProps> = ({
  onReviewSend,
  onCancel,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState("");

  const walletBalance = 3.5; // Example balance
  const gasEstimate = 0.005;
  const totalWithGas = parseFloat(amount || "0") + gasEstimate;

  const validateForm = (): boolean => {
    if (!recipient.trim()) {
      setError("Please enter a recipient address.");
      return false;
    }

    if (!amount.trim() || parseFloat(amount) <= 0) {
      setError("Please enter an amount greater than 0.");
      return false;
    }

    if (parseFloat(amount) > walletBalance - gasEstimate) {
      setError(
        `Insufficient balance. Available: ${(walletBalance - gasEstimate).toFixed(4)} ETH`,
      );
      return false;
    }

    if (recipient.length < 20) {
      setError("Address appears invalid.");
      return false;
    }

    setError("");
    return true;
  };

  const handleReviewSend = () => {
    if (!validateForm()) return;

    setIsReviewing(true);
    // Simulate transition (1 second)
    setTimeout(() => {
      onReviewSend?.(recipient, amount);
      setIsReviewing(false);
    }, 1000);
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 24,
          gap: 24,
          paddingBottom: 32,
        }}
      >
        {/* HEADER */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary }}>Send Transaction</Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.textSecondary,
            }}
          >
            Transfer funds securely to any address.
          </Text>
        </View>

        {/* WALLET BALANCE (Critical Data - Z-Pattern Top) */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted }}>YOUR BALANCE</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 24 }}>💰</Text>
              <Text
                style={{ fontSize: 28, fontWeight: "bold", color: colors.textPrimary }}
              >
                {walletBalance.toFixed(4)} ETH
              </Text>
            </View>
            <Text
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              Available to send: {(walletBalance - gasEstimate).toFixed(4)} ETH
            </Text>
          </View>
        </View>

        {/* RECIPIENT INPUT */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: colors.accent }}>SEND TO</Text>
              <Text style={{ fontSize: 14 }}>🔒</Text>
            </View>

            <View>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 6 }}>Recipient Address</Text>
              <TextInput
                placeholder="0x742d35Cc6634C0532925a3b844Bc7e7595f..."
                placeholderTextColor={colors.textMuted}
                value={recipient}
                onChangeText={(value) => {
                  setRecipient(value);
                  if (error.includes("recipient")) setError("");
                }}
                editable={!isReviewing}
                style={{ backgroundColor: withAlpha(colors.textPrimary, 0.06), borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.borderMuted }}
              />
            </View>

            <Text
              style={{ fontSize: 11, color: colors.textMuted }}
            >
              ✓ Address will be verified before sending
            </Text>
          </View>
        </View>

        {/* AMOUNT INPUT */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: colors.accent }}>AMOUNT</Text>
              <Text style={{ fontSize: 14 }}>🔒</Text>
            </View>

            <View>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 6 }}>Amount (ETH)</Text>
              <TextInput
                placeholder="0.5"
                placeholderTextColor={colors.textMuted}
                value={amount}
                onChangeText={(value) => {
                  setAmount(value);
                  if (error.includes("amount")) setError("");
                }}
                editable={!isReviewing}
                keyboardType="decimal-pad"
                style={{ backgroundColor: withAlpha(colors.textPrimary, 0.06), borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.borderMuted }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{ fontSize: 11, color: colors.textMuted }}
              >
                🔒 Protected by your device
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setAmount((walletBalance - gasEstimate).toFixed(4))
                }
                disabled={isReviewing}
                activeOpacity={0.85}
                style={{ borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>Max</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ERROR MESSAGE */}
        {error && (
          <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: withAlpha(colors.danger, 0.1),
                borderLeftWidth: 4,
                borderLeftColor: colors.danger,
              }}
            >
              <Text style={{ fontSize: 16 }}>⚠️</Text>
              <Text
                style={{ flex: 1, fontSize: 12, color: colors.danger }}
              >
                {error}
              </Text>
            </View>
          </View>
        )}

        {/* GAS ESTIMATE */}
        {amount && !error && (
          <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: colors.accent }}>
                TRANSACTION DETAILS
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                  }}
                >
                  Amount
                </Text>
                <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
                  {amount} ETH
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                  }}
                >
                  Network Fee
                </Text>
                <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
                  {gasEstimate.toFixed(5)} ETH
                </Text>
              </View>

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.borderMuted,
                  paddingTop: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "bold", color: colors.textPrimary }}>
                    Total
                  </Text>
                  <Text
                    style={{ fontWeight: "bold", fontSize: 18, color: colors.textPrimary }}
                  >
                    {totalWithGas.toFixed(5)} ETH
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* SECURITY BADGE */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 18 }}>🛡</Text>
            <Text
              style={{ fontWeight: "600", fontSize: 13, color: colors.success }}
            >
              This transaction will be protected by your device
            </Text>
          </View>
        </View>

        {/* PRIMARY ACTION - Rule of One */}
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            onPress={handleReviewSend}
            disabled={isReviewing || !recipient || !amount}
            activeOpacity={0.85}
            style={{ backgroundColor: (isReviewing || !recipient || !amount) ? withAlpha(colors.accent, 0.5) : colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
          >
            <Text style={{ color: colors.textOnAccent, fontSize: 16, fontWeight: "700" }}>{isReviewing ? "Preparing..." : "Review & Send"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onCancel}
            disabled={isReviewing}
            activeOpacity={0.85}
            style={{ borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SendScreen;
