/**
 * ThresholdConfigurationScreen.tsx
 *
 * Configure how many trusted contacts are required to approve a recovery request.
 *
 * Displays:
 * - Dynamic threshold selector (1 of N)
 * - Security risk/recommendation indicator
 * - Confirmation CTA
 *
 * Constraints Applied:
 * - Direct selection of threshold
 * - Professional warning for "1 of N" configurations
 * - Recovery UX: "Security Threshold" terminology
 */

import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";


interface ThresholdConfigurationScreenProps {
  onSaveConfiguration?: (threshold: number) => void;
  onCancel?: () => void;
}

export const ThresholdConfigurationScreen: React.FC<
  ThresholdConfigurationScreenProps
> = ({ onSaveConfiguration, onCancel }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  
  // These would typically come from a store or props
  const [totalContacts] = useState(3);
  const [selectedThreshold, setSelectedThreshold] = useState(2);
  const isSaving = false;

  const getSecurityLevel = (threshold: number, total: number) => {
    if (total <= 1) return { label: "Limited", color: colors.warning, softBg: colors.warningSoft, icon: "alert-triangle" as const };
    if (threshold === 1) return { label: "Low Security", color: colors.danger, softBg: colors.dangerSoft, icon: "shield" as const };
    if (threshold === total) return { label: "Strict", color: colors.success, softBg: colors.successSoft, icon: "lock" as const };
    return { label: "Balanced", color: colors.success, softBg: colors.successSoft, icon: "check-circle" as const };
  };

  const security = getSecurityLevel(selectedThreshold, totalContacts);

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
          gap: 32,
          paddingBottom: 40,
        }}
      >
        {/* HEADER SECTION */}
        <View style={{ gap: 8 }}>
          <TouchableOpacity 
            onPress={onCancel}
            style={{
              marginBottom: 8,
              width: 40,
              height: 40,
              borderRadius: 9999,
              backgroundColor: colors.glass,
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Feather name="chevron-left" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "600",
              color: colors.textPrimary,
            }}
          >
            Security Threshold
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.textSecondary,
              lineHeight: 22
            }}
          >
            Choose how many of your {totalContacts} trusted contacts must approve a recovery attempt.
          </Text>
        </View>

        {/* THRESHOLD SELECTOR */}
        <View style={{ gap: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 1,
              color: colors.accent,
              paddingHorizontal: 4
            }}
          >
            SELECT APPROVALS REQUIRED
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {Array.from({ length: totalContacts }, (_, i) => i + 1).map((num) => {
              const isSelected = selectedThreshold === num;
              return (
                <TouchableOpacity
                  key={num}
                  activeOpacity={0.8}
                  onPress={() => setSelectedThreshold(num)}
                  style={{
                    width: '30%',
                    aspectRatio: 1,
                    backgroundColor: isSelected ? colors.accent : colors.glass,
                    borderRadius: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: isSelected ? colors.accent : colors.borderMuted,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: "600",
                      color: isSelected ? colors.textOnAccent : colors.textPrimary,
                    }}
                  >
                    {num}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "600",
                      color: isSelected ? colors.textOnAccent : colors.textSecondary,
                      marginTop: 4
                    }}
                  >
                    CONTACT{num > 1 ? 'S' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SECURITY ANALYSIS CARD */}
        <View
          style={{
            backgroundColor: security.softBg,
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 16
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 9999,
                backgroundColor: security.softBg,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Feather name={security.icon} size={20} color={security.color} />
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: security.color, letterSpacing: 0.5 }}>
                SECURITY ANALYSIS
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                {security.label}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22 }}>
            {selectedThreshold === 1
              ? "One contact alone can recover your account, so a single compromised contact is enough."
              : selectedThreshold === totalContacts
              ? "Every contact must approve; if one loses access, recovery becomes impossible."
              : `Requiring ${selectedThreshold} of ${totalContacts} balances protection against both compromise and lost access.`}
          </Text>

          {selectedThreshold === 1 && (
            <View style={{
              backgroundColor: colors.dangerSoft,
              padding: 12,
              borderRadius: 8,
              borderLeftWidth: 3,
              borderLeftColor: colors.danger
            }}>
              <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '600' }}>
                We strongly recommend adding more contacts or increasing the threshold.
              </Text>
            </View>
          )}
        </View>

        {/* ACTIONS */}
        <View style={{ gap: 12, marginTop: 'auto' }}>
          <TouchableOpacity
            onPress={() => onSaveConfiguration?.(selectedThreshold)}
            activeOpacity={0.85}
            disabled={isSaving}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 16,
              paddingVertical: 18,
              alignItems: "center",
              shadowColor: colors.accent,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 6
            }}
          >
            <Text
              style={{
                color: colors.textOnAccent,
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              {isSaving ? "Saving Configuration..." : "Save Configuration"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.7}
            style={{
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                fontWeight: "600",
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ThresholdConfigurationScreen;

