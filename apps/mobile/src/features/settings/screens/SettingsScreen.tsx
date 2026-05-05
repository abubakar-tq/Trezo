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
import { Colors, Spacing } from "../../../shared/components/TokenRegistry";

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
        backgroundColor: isDark ? Colors.background : "#ffffff",
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
          <HeadlineText isDark={isDark}>Settings</HeadlineText>
          <BodyText
            isDark={isDark}
            color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
          >
            Customize your app experience and security preferences.
          </BodyText>
        </View>

        {/* SECURITY SECTION */}
        <View style={{ gap: Spacing.sp2 }}>
          <CaptionText color={Colors.primary}>SECURITY</CaptionText>

          <CardLevel1 isDark={isDark}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: Spacing.sp2,
              }}
            >
              <View style={{ flex: 1, gap: Spacing.sp1 }}>
                <BodyText isDark={isDark} style={{ fontWeight: "600" }}>
                  Biometric Login
                </BodyText>
                <BodyText
                  isDark={isDark}
                  color={
                    isDark ? Colors.textTertiary : Colors.lightTextTertiary
                  }
                  style={{ fontSize: 12 }}
                >
                  Face ID or Touch ID to unlock
                </BodyText>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={setBiometricsEnabled}
                trackColor={{ false: Colors.surfaceMid, true: Colors.primary }}
                thumbColor={Colors.background}
              />
            </View>
          </CardLevel1>

          <CardLevel1 isDark={isDark}>
            <View style={{ gap: Spacing.sp2 }}>
              <BodyText isDark={isDark} style={{ fontWeight: "600" }}>
                Change Passkey
              </BodyText>
              <BodyText
                isDark={isDark}
                color={isDark ? Colors.textTertiary : Colors.lightTextTertiary}
                style={{ fontSize: 12 }}
              >
                Update your device passkey for account access
              </BodyText>
              <SecondaryButton
                label="Update"
                isDark={isDark}
                onPress={() => {}}
              />
            </View>
          </CardLevel1>

          <CardLevel1 isDark={isDark}>
            <View style={{ gap: Spacing.sp2 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: Spacing.sp2,
                }}
              >
                <BodyText
                  isDark={isDark}
                  style={{ fontWeight: "600", flex: 1 }}
                >
                  Export Account Data
                </BodyText>
                <Badge isDark={isDark} status="warning" label="⚠️ Advanced" />
              </View>
              <BodyText
                isDark={isDark}
                color={Colors.warning}
                style={{ fontSize: 12 }}
              >
                Only for backup purposes. Never share this data.
              </BodyText>
              <SecondaryButton
                label="Export"
                isDark={isDark}
                onPress={onExportAccount}
              />
            </View>
          </CardLevel1>
        </View>

        {/* NOTIFICATIONS SECTION */}
        <View style={{ gap: Spacing.sp2 }}>
          <CaptionText color={Colors.primary}>NOTIFICATIONS</CaptionText>

          <CardLevel1 isDark={isDark}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: Spacing.sp2,
              }}
            >
              <View style={{ flex: 1, gap: Spacing.sp1 }}>
                <BodyText isDark={isDark} style={{ fontWeight: "600" }}>
                  Transaction Alerts
                </BodyText>
                <BodyText
                  isDark={isDark}
                  color={
                    isDark ? Colors.textTertiary : Colors.lightTextTertiary
                  }
                  style={{ fontSize: 12 }}
                >
                  Notifications for sends and receives
                </BodyText>
              </View>
              <Switch
                value={transactionNotifications}
                onValueChange={setTransactionNotifications}
                trackColor={{ false: Colors.surfaceMid, true: Colors.primary }}
                thumbColor={Colors.background}
              />
            </View>
          </CardLevel1>

          <CardLevel1 isDark={isDark}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: Spacing.sp2,
              }}
            >
              <View style={{ flex: 1, gap: Spacing.sp1 }}>
                <BodyText isDark={isDark} style={{ fontWeight: "600" }}>
                  Network Alerts
                </BodyText>
                <BodyText
                  isDark={isDark}
                  color={
                    isDark ? Colors.textTertiary : Colors.lightTextTertiary
                  }
                  style={{ fontSize: 12 }}
                >
                  Warnings for network issues
                </BodyText>
              </View>
              <Switch
                value={networkAlerts}
                onValueChange={setNetworkAlerts}
                trackColor={{ false: Colors.surfaceMid, true: Colors.primary }}
                thumbColor={Colors.background}
              />
            </View>
          </CardLevel1>
        </View>

        {/* APPEARANCE SECTION */}
        <View style={{ gap: Spacing.sp2 }}>
          <CaptionText color={Colors.primary}>APPEARANCE</CaptionText>

          <CardLevel1 isDark={isDark}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: Spacing.sp2,
              }}
            >
              <View style={{ flex: 1, gap: Spacing.sp1 }}>
                <BodyText isDark={isDark} style={{ fontWeight: "600" }}>
                  Dark Mode
                </BodyText>
                <BodyText
                  isDark={isDark}
                  color={
                    isDark ? Colors.textTertiary : Colors.lightTextTertiary
                  }
                  style={{ fontSize: 12 }}
                >
                  Current theme: {isDark ? "Dark" : "Light"}
                </BodyText>
              </View>
              <Switch
                value={isDark}
                onValueChange={onToggleDarkMode}
                trackColor={{ false: Colors.surfaceMid, true: Colors.primary }}
                thumbColor={Colors.background}
              />
            </View>
          </CardLevel1>
        </View>

        {/* SUPPORT SECTION */}
        <View style={{ gap: Spacing.sp2 }}>
          <CaptionText color={Colors.primary}>SUPPORT</CaptionText>

          <CardLevel1 isDark={isDark}>
            <View style={{ gap: Spacing.sp2 }}>
              <BodyText isDark={isDark} style={{ fontWeight: "600" }}>
                Help & FAQ
              </BodyText>
              <BodyText
                isDark={isDark}
                color={isDark ? Colors.textTertiary : Colors.lightTextTertiary}
                style={{ fontSize: 12 }}
              >
                Common questions and troubleshooting
              </BodyText>
              <SecondaryButton
                label="View Help"
                isDark={isDark}
                onPress={() => {}}
              />
            </View>
          </CardLevel1>

          <CardLevel1 isDark={isDark}>
            <View style={{ gap: Spacing.sp2 }}>
              <BodyText isDark={isDark} style={{ fontWeight: "600" }}>
                Report Issue
              </BodyText>
              <BodyText
                isDark={isDark}
                color={isDark ? Colors.textTertiary : Colors.lightTextTertiary}
                style={{ fontSize: 12 }}
              >
                Send feedback or report a bug
              </BodyText>
              <SecondaryButton
                label="Contact Support"
                isDark={isDark}
                onPress={() => {}}
              />
            </View>
          </CardLevel1>
        </View>

        {/* APP INFO */}
        <Surface isDark={isDark} elevation={1}>
          <View style={{ gap: Spacing.sp2 }}>
            <CaptionText color={Colors.primary}>APP INFORMATION</CaptionText>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <BodyText
                isDark={isDark}
                color={
                  isDark ? Colors.textSecondary : Colors.lightTextSecondary
                }
              >
                Version
              </BodyText>
              <BodyText isDark={isDark} style={{ fontWeight: "600" }}>
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
                isDark={isDark}
                color={
                  isDark ? Colors.textSecondary : Colors.lightTextSecondary
                }
              >
                Build
              </BodyText>
              <BodyText isDark={isDark} style={{ fontWeight: "600" }}>
                {buildNumber}
              </BodyText>
            </View>
          </View>
        </Surface>

        {/* LOGOUT */}
        <View style={{ gap: Spacing.sp2 }}>
          <GhostButton label="Logout" isDark={isDark} onPress={onLogout} />

          <BodyText
            isDark={isDark}
            color={Colors.danger}
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
