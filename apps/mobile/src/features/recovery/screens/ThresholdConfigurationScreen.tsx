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
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

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
    if (total <= 1) return { label: "Limited", color: colors.warning, icon: "⚠️" };
    if (threshold === 1) return { label: "Low Security", color: colors.danger, icon: "🛡️" };
    if (threshold === total) return { label: "Strict", color: colors.success, icon: "🔒" };
    return { label: "Balanced", color: colors.accent, icon: "✅" };
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
              borderRadius: 20,
              backgroundColor: withAlpha(colors.textPrimary, 0.05),
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>←</Text>
          </TouchableOpacity>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "800",
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
                    backgroundColor: isSelected ? colors.accent : withAlpha(colors.textPrimary, 0.03),
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: isSelected ? colors.accent : colors.borderMuted,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: "800",
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
            backgroundColor: withAlpha(security.color, 0.08),
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: withAlpha(security.color, 0.2),
            gap: 16
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View 
              style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 22, 
                backgroundColor: withAlpha(security.color, 0.15),
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Text style={{ fontSize: 20 }}>{security.icon}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: security.color, letterSpacing: 0.5 }}>
                SECURITY ANALYSIS
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
                {security.label}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22 }}>
            {selectedThreshold === 1 
              ? "High Risk: Only one contact is needed to access your account. This is vulnerable if a contact's email is compromised."
              : selectedThreshold === totalContacts
              ? "Strict Security: Every single contact must approve. If even one contact loses access, recovery becomes impossible."
              : `Recommended: Requiring ${selectedThreshold} of ${totalContacts} contacts provides optimal protection against both compromise and loss of access.`}
          </Text>

          {selectedThreshold === 1 && (
            <View style={{ 
              backgroundColor: withAlpha(colors.danger, 0.1), 
              padding: 12, 
              borderRadius: 12,
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

