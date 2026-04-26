/**
 * ReceiveScreen.tsx
 *
 * Receive transaction screen with QR code display.
 *
 * Constraints Applied:
 * - Rule of One: Single "Copy Address" primary button
 * - Trust Markers: Shield icon on address, reassurance microcopy
 * - Z-Pattern: QR code center, address below, action buttons bottom
 * - Share functionality for address
 * - No sensitive key exposure
 */

import React, { useState } from "react";
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity } from "react-native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

interface ReceiveScreenProps {
  onCopyAddress?: (address: string) => void;
  onShare?: (address: string) => void;
  onClose?: () => void;
}

export const ReceiveScreen: React.FC<ReceiveScreenProps> = ({
  onCopyAddress,
  onShare,
  onClose,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const walletAddress = "0x742d35Cc6634C0532925a3b844Bc7e7595f0Af";
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    onCopyAddress?.(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    onShare?.(walletAddress);
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
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary }}>Receive Funds</Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.textSecondary,
            }}
          >
            Share your address to receive transactions from anyone.
          </Text>
        </View>

        {/* QR CODE PLACEHOLDER (Center - Z-Pattern) */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 32,
              gap: 8,
            }}
          >
            {/* QR CODE VISUAL */}
            <View
              style={{
                width: 200,
                height: 200,
                backgroundColor: colors.background,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: colors.borderMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 64 }}>◻️</Text>
            </View>

            <Text style={{ fontSize: 13, color: colors.textMuted }}>
              Your Wallet QR Code
            </Text>
          </View>
        </View>

        {/* WALLET ADDRESS */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: colors.accent }}>WALLET ADDRESS</Text>
              <Text style={{ fontSize: 14 }}>🛡</Text>
            </View>

            <View
              style={{
                backgroundColor: colors.background,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.borderMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "monospace",
                  lineHeight: 18,
                  color: colors.textPrimary,
                }}
              >
                {walletAddress}
              </Text>
            </View>

            <Text
              style={{ fontSize: 11, color: colors.textMuted }}
            >
              ✓ Only you can access funds sent to this address
            </Text>
          </View>
        </View>

        {/* NETWORK INFORMATION */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: colors.accent }}>RECEIVING ON</Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 20 }}>⛓️</Text>
              <View>
                <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
                  Ethereum Mainnet
                </Text>
                <Text
                  style={{ fontSize: 12, color: colors.textSecondary }}
                >
                  Mainnet (Chain ID: 1)
                </Text>
              </View>
            </View>

            <Text
              style={{ fontSize: 12, fontWeight: "600", color: colors.warning }}
            >
              ⚠️ Only send Ethereum to this address. Sending other assets may
              result in permanent loss.
            </Text>
          </View>
        </View>

        {/* TRUST MARKER */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 18 }}>🛡</Text>
            <Text
              style={{ fontWeight: "600", fontSize: 13, color: colors.success }}
            >
              Your funds are protected by your device's security
            </Text>
            <Text
              style={{ fontSize: 11, color: colors.textMuted }}
            >
              Your private key never leaves your device. Transactions are signed
              locally and verified before sending.
            </Text>
          </View>
        </View>

        {/* HOW IT WORKS */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>How to receive</Text>
            <Text
              style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}
            >
              1. Share this address with the sender{"\n"}
              2. Or scan your QR code{"\n"}
              3. Funds will arrive instantly{"\n"}
              4. No additional steps needed
            </Text>
          </View>
        </View>

        {/* PRIMARY ACTIONS - Rule of One: Copy is primary */}
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            onPress={handleCopyAddress}
            activeOpacity={0.85}
            style={{ backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
          >
            <Text style={{ color: colors.textOnAccent, fontSize: 16, fontWeight: "700" }}>{copied ? "✓ Copied" : "Copy Address"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.85}
            style={{ borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            style={{ paddingVertical: 12, alignItems: "center" }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>Close</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReceiveScreen;
