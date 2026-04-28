/**
 * SecurityCenterScreen.tsx
 *
 * Hero feature: Complete recovery and security management hub
 *
 * Displays:
 * - Full Recovery Score widget with breakdown
 * - Active guardians summary
 * - Removed contacts (audit trail)
 * - Three primary actions: Manage Guardians, Configure Threshold, Add Contact
 */

import { EmailRecoveryService } from "@features/wallet/services/EmailRecoveryService";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useRecoveryStatusStore } from "@store/useRecoveryStatusStore";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { Address } from "viem";
import React, { useEffect, useMemo, useState } from "react";
import {
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface SecurityCenterScreenProps {
  onManageGuardians?: () => void;
  onConfigureThreshold?: () => void;
  onAddContact?: () => void;
  onEmailRecovery?: () => void;
}

export const SecurityCenterScreen: React.FC<SecurityCenterScreenProps> = ({
  onManageGuardians,
  onConfigureThreshold,
  onAddContact,
  onEmailRecovery,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [showRemovedContacts, setShowRemovedContacts] = useState(false);
  const guardians = useRecoveryStatusStore((state) => state.guardians);
  const requiredSignatures = useRecoveryStatusStore(
    (state) => state.requiredSignatures,
  );
  const totalGuardians = useRecoveryStatusStore(
    (state) => state.totalGuardians,
  );
  const passkeys = useWalletStore((state) => state.passkeys);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const storedSmartAccountAddress = useUserStore(
    (state) => state.smartAccountAddress,
  );
  const [emailRecoveryActive, setEmailRecoveryActive] = useState(false);
  const [emailRecoveryLoading, setEmailRecoveryLoading] = useState(false);

  const smartAccountAddress = useMemo(
    () => (aaAccount?.predictedAddress ?? storedSmartAccountAddress ?? undefined) as Address | undefined,
    [aaAccount?.predictedAddress, storedSmartAccountAddress],
  );

  useEffect(() => {
    if (!smartAccountAddress) {
      setEmailRecoveryActive(false);
      return;
    }

    let cancelled = false;
    setEmailRecoveryLoading(true);
    EmailRecoveryService.loadMetadata({ smartAccountAddress })
      .then((metadata) => {
        if (cancelled) return;
        const activeInstall = metadata?.installations?.some(
          (install) =>
            install.installStatus === "installed" ||
            install.installStatus === "pending",
        );
        setEmailRecoveryActive(Boolean(activeInstall));
      })
      .catch(() => {
        if (!cancelled) setEmailRecoveryActive(false);
      })
      .finally(() => {
        if (!cancelled) setEmailRecoveryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [smartAccountAddress]);

  const guardianCount = guardians.length;
  const totalContacts = Math.max(totalGuardians, guardianCount, 1);
  const passkeyActive = passkeys.length > 0;

  const score = useMemo(() => {
    const passkeyScore = passkeyActive ? 20 : 0;
    const emailScore = emailRecoveryActive ? 25 : 0;
    const guardianScore =
      guardianCount >= 2 ? 25 : guardianCount === 1 ? 15 : 0;
    const thresholdScore = guardianCount > 0 && requiredSignatures > 1 ? 10 : 0;
    const total = passkeyScore + emailScore + guardianScore + thresholdScore;
    return Math.min(total, 100);
  }, [emailRecoveryActive, guardianCount, passkeyActive, requiredSignatures]);

  const scoreMeta = useMemo(() => {
    if (score >= 100) {
      return { label: "Fully protected", color: colors.success };
    }
    if (score >= 75) {
      return { label: "Almost protected", color: colors.accent };
    }
    if (score >= 41) {
      return { label: "Getting there", color: colors.warning };
    }
    return { label: "Not set up yet", color: colors.textMuted };
  }, [colors, score]);

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
        {/* HERO SECTION */}
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: colors.textPrimary,
            }}
          >
            Security Center
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.textSecondary,
            }}
          >
            Manage your recovery options and trusted contacts.
          </Text>
        </View>

        {/* RECOVERY SCORE - FULL WIDGET */}
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <View style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 20 }}>🛡</Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1,
                  color: colors.accent,
                }}
              >
                YOUR SECURITY SCORE
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <View style={{ gap: 4 }}>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "800",
                    color: colors.textPrimary,
                  }}
                >
                  {score}/100
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: scoreMeta.color,
                    fontWeight: "600",
                  }}
                >
                  {scoreMeta.label}
                </Text>
              </View>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  borderWidth: 6,
                  borderColor: scoreMeta.color,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: scoreMeta.color,
                  }}
                >
                  {score}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ACTIVE TRUSTED CONTACTS SUMMARY */}
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1,
                  color: colors.accent,
                }}
              >
                ACTIVE TRUSTED CONTACTS
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.accent,
                  fontWeight: "700",
                }}
              >
                {guardianCount} of {totalContacts}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              {guardianCount > 0
                ? `You have ${guardianCount} active trusted contact${guardianCount === 1 ? "" : "s"} helping protect your account.`
                : "You have no trusted contacts yet. Add one to increase protection."}
            </Text>

            <TouchableOpacity
              onPress={onManageGuardians}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <Text
                style={{
                  color: colors.textOnAccent,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                Manage Guardians
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* APPROVAL REQUIREMENT CONFIGURATION */}
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <View style={{ gap: 12 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 1,
                color: colors.accent,
              }}
            >
              APPROVAL REQUIREMENT
            </Text>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 15, color: colors.textPrimary }}>
                Currently:{" "}
                <Text style={{ fontWeight: "700" }}>
                  {requiredSignatures} out of {totalContacts}
                </Text>
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Your trusted contacts must collectively approve any recovery
                request.
              </Text>
              {guardianCount > 0 && requiredSignatures > guardianCount && (
                <Text style={{ fontSize: 12, color: colors.warning }}>
                  Add {requiredSignatures - guardianCount} more trusted contact
                  {requiredSignatures - guardianCount === 1 ? "" : "s"} to
                  require {requiredSignatures} approvals.
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={onConfigureThreshold}
              activeOpacity={0.85}
              style={{
                backgroundColor: withAlpha(colors.accent, 0.1),
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                Configure Threshold
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* EMAIL RECOVERY */}
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <View style={{ gap: 12 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 1,
                color: colors.accent,
              }}
            >
              TRUSTED EMAIL
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              {emailRecoveryLoading
                ? "Checking email recovery status..."
                : emailRecoveryActive
                  ? "Email recovery is active on this account."
                  : "Add a trusted email to unlock an extra recovery path."}
            </Text>

            <TouchableOpacity
              onPress={onEmailRecovery}
              activeOpacity={0.85}
              style={{
                backgroundColor: withAlpha(colors.accent, 0.1),
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                Manage Email Recovery
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* QUICK ADD CONTACT */}
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <View style={{ gap: 12 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 1,
                color: colors.accent,
              }}
            >
              ADD ANOTHER CONTACT
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              Increase your Security Score by adding more trusted contacts.
            </Text>

            <TouchableOpacity
              onPress={onAddContact}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <Text
                style={{
                  color: colors.textOnAccent,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                Add Trusted Contact
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* REMOVED CONTACTS (AUDIT TRAIL) */}
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: 24,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowRemovedContacts(!showRemovedContacts)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {showRemovedContacts
                  ? "▼ Removed Contacts (0)"
                  : "▶ Removed Contacts (0)"}
              </Text>
            </TouchableOpacity>

            {showRemovedContacts && (
              <View
                style={{
                  gap: 12,
                  marginTop: 8,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderMuted,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    textAlign: "center",
                  }}
                >
                  No removed contacts yet. Audit trail will appear here.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* HELP SECTION */}
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.textPrimary,
              }}
            >
              How does recovery work?
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                lineHeight: 20,
              }}
            >
              If you ever lose access to your device, your trusted contacts can
              help you regain control of your account. They verify your identity
              and collectively approve recovery requests.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SecurityCenterScreen;
