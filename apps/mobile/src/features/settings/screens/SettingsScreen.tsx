/**
 * SettingsScreen.tsx
 *
 * App preferences and configuration screen.
 *
 * Constraints Applied:
 * - Rule of One: Settings are secondary level (no primary action)
 * - Microcopy: Clear explanations for each setting
 * - Empty state: No critical data needed
 * - Grouped settings by category
 */

import React, { useState } from "react";
import { SafeAreaView, ScrollView, Switch, View } from "react-native";
import { Badge } from "../../../shared/components/Tier1/Badge";
import {
    GhostButton,
    SecondaryButton,
} from "../../../shared/components/Tier1/Button";
import { CardLevel1, Surface } from "../../../shared/components/Tier1/Surface";
import {
    BodyText,
    CaptionText,
    HeadlineText
} from "../../../shared/components/Tier1/Text";
import { Spacing } from "../../../shared/components/TokenRegistry";
import { useAppTheme } from "@theme";

interface SettingsScreenProps {
  isDark?: boolean;
  onToggleDarkMode?: (enabled: boolean) => void;
  onLogout?: () => void;
  onExportAccount?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  isDark = true,
  onToggleDarkMode,
  onLogout,
  onExportAccount,
}) => {
  const { theme: { colors } } = useAppTheme();
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [transactionNotifications, setTransactionNotifications] =
    useState(true);
  const [networkAlerts, setNetworkAlerts] = useState(true);

  const appVersion = "1.0.0";
  const buildNumber = "42";

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.sp4,
          paddingVertical: Spacing.sp6,
          gap: Spacing.sp6,
          paddingBottom: Spacing.sp8,
        }}
      >
        {/* HEADER */}
        <View style={{ gap: Spacing.sp2 }}>
          <HeadlineText>Settings</HeadlineText>
          <BodyText
            color={colors.textSecondary}
          >
            Customize your app experience and security preferences.
          </BodyText>
        </View>

        {/* SECURITY SECTION */}
        <View style={{ gap: Spacing.sp2 }}>
          <CaptionText color={colors.accent}>SECURITY</CaptionText>

          <CardLevel1>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: Spacing.sp2,
              }}
            >
              <View style={{ flex: 1, gap: Spacing.sp1 }}>
                <BodyText style={{ fontWeight: "600" }}>
                  Biometric Login
                </BodyText>
                <BodyText
                  color={colors.textMuted}
                  style={{ fontSize: 12 }}
                >
                  Face ID or Touch ID to unlock
                </BodyText>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={setBiometricsEnabled}
                trackColor={{ false: colors.surfaceCard, true: colors.accent }}
                thumbColor={colors.background}
              />
            </View>
          </CardLevel1>

          <CardLevel1>
            <View style={{ gap: Spacing.sp2 }}>
              <BodyText style={{ fontWeight: "600" }}>
                Change Passkey
              </BodyText>
              <BodyText
                color={colors.textMuted}
                style={{ fontSize: 12 }}
              >
                Update your device passkey for account access
              </BodyText>
              <SecondaryButton
                label="Update"
                onPress={() => {}}
              />
            </View>
          </CardLevel1>

          <CardLevel1>
            <View style={{ gap: Spacing.sp2 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: Spacing.sp2,
                }}
              >
                <BodyText
                  style={{ fontWeight: "600", flex: 1 }}
                >
                  Export Account Data
                </BodyText>
                <Badge status="warning" label="⚠️ Advanced" />
              </View>
              <BodyText
                color={colors.warning}
                style={{ fontSize: 12 }}
              >
                Only for backup purposes. Never share this data.
              </BodyText>
              <SecondaryButton
                label="Export"
                onPress={onExportAccount}
              />
            </View>
          </CardLevel1>
        </View>

        {/* NOTIFICATIONS SECTION */}
        <View style={{ gap: Spacing.sp2 }}>
          <CaptionText color={colors.accent}>NOTIFICATIONS</CaptionText>

          <CardLevel1>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: Spacing.sp2,
              }}
            >
              <View style={{ flex: 1, gap: Spacing.sp1 }}>
                <BodyText style={{ fontWeight: "600" }}>
                  Transaction Alerts
                </BodyText>
                <BodyText
                  color={colors.textMuted}
                  style={{ fontSize: 12 }}
                >
                  Notifications for sends and receives
                </BodyText>
              </View>
              <Switch
                value={transactionNotifications}
                onValueChange={setTransactionNotifications}
                trackColor={{ false: colors.surfaceCard, true: colors.accent }}
                thumbColor={colors.background}
              />
            </View>
          </CardLevel1>

          <CardLevel1>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: Spacing.sp2,
              }}
            >
              <View style={{ flex: 1, gap: Spacing.sp1 }}>
                <BodyText style={{ fontWeight: "600" }}>
                  Network Alerts
                </BodyText>
                <BodyText
                  color={colors.textMuted}
                  style={{ fontSize: 12 }}
                >
                  Warnings for network issues
                </BodyText>
              </View>
              <Switch
                value={networkAlerts}
                onValueChange={setNetworkAlerts}
                trackColor={{ false: colors.surfaceCard, true: colors.accent }}
                thumbColor={colors.background}
              />
            </View>
          </CardLevel1>
        </View>

        {/* APPEARANCE SECTION */}
        <View style={{ gap: Spacing.sp2 }}>
          <CaptionText color={colors.accent}>APPEARANCE</CaptionText>

          <CardLevel1>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: Spacing.sp2,
              }}
            >
              <View style={{ flex: 1, gap: Spacing.sp1 }}>
                <BodyText style={{ fontWeight: "600" }}>
                  Dark Mode
                </BodyText>
                <BodyText
                  color={colors.textMuted}
                  style={{ fontSize: 12 }}
                >
                  Current theme: {isDark ? "Dark" : "Light"}
                </BodyText>
              </View>
              <Switch
                value={isDark}
                onValueChange={onToggleDarkMode}
                trackColor={{ false: colors.surfaceCard, true: colors.accent }}
                thumbColor={colors.background}
              />
            </View>
          </CardLevel1>
        </View>

        {/* SUPPORT SECTION */}
        <View style={{ gap: Spacing.sp2 }}>
          <CaptionText color={colors.accent}>SUPPORT</CaptionText>

          <CardLevel1>
            <View style={{ gap: Spacing.sp2 }}>
              <BodyText style={{ fontWeight: "600" }}>
                Help & FAQ
              </BodyText>
              <BodyText
                color={colors.textMuted}
                style={{ fontSize: 12 }}
              >
                Common questions and troubleshooting
              </BodyText>
              <SecondaryButton
                label="View Help"
                onPress={() => {}}
              />
            </View>
          </CardLevel1>

          <CardLevel1>
            <View style={{ gap: Spacing.sp2 }}>
              <BodyText style={{ fontWeight: "600" }}>
                Report Issue
              </BodyText>
              <BodyText
                color={colors.textMuted}
                style={{ fontSize: 12 }}
              >
                Send feedback or report a bug
              </BodyText>
              <SecondaryButton
                label="Contact Support"
                onPress={() => {}}
              />
            </View>
          </CardLevel1>
        </View>

        {/* APP INFO */}
        <Surface elevation={1}>
          <View style={{ gap: Spacing.sp2 }}>
            <CaptionText color={colors.accent}>APP INFORMATION</CaptionText>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <BodyText
                color={colors.textSecondary}
              >
                Version
              </BodyText>
              <BodyText style={{ fontWeight: "600" }}>
                {appVersion}
              </BodyText>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <BodyText
                color={colors.textSecondary}
              >
                Build
              </BodyText>
              <BodyText style={{ fontWeight: "600" }}>
                {buildNumber}
              </BodyText>
            </View>
          </View>
        </Surface>

        {/* LOGOUT */}
        <View style={{ gap: Spacing.sp2 }}>
          <GhostButton label="Logout" onPress={onLogout} />

          <BodyText
            color={colors.danger}
            style={{ fontSize: 12, textAlign: "center" }}
          >
            ⚠️ Make sure you have backed up your recovery information
          </BodyText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
