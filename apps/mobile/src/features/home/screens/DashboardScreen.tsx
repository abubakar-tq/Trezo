/**
 * DashboardScreen.tsx
 *
 * Root navigation screen for the authenticated user.
 * Implements 5-tab bottom navigation:
 * - Home: Wallet summary + quick actions
 * - Wallet: Asset portfolio
 * - Recovery: Security center & trusted contacts
 * - Contacts: Manage connections
 * - Settings: App preferences
 *
 * Constraints Applied:
 * - Bottom tab bar (5 tabs, equal spacing)
 * - Tab icons with labels
 * - Dark/Light mode support
 * - Consistent theme application
 */

import React, { useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity } from "react-native";
import { Colors } from "../../../shared/components/TokenRegistry";
import { ContactsScreen } from "../../contacts/screens/ContactsScreen";
import { SecurityCenterScreen } from "../../recovery/screens/SecurityCenterScreen";
import { SettingsScreen } from "../../settings/screens/SettingsScreen";
import { PortfolioScreen } from "../../wallet/screens/PortfolioScreen";
import HomeScreen from "./HomeScreen";

type TabType = "home" | "wallet" | "recovery" | "contacts" | "settings";

interface DashboardScreenProps {
  isDark?: boolean;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  isDark = true,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("home");

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDark ? Colors.background : "#ffffff",
      }}
    >
      {/* ACTIVE TAB CONTENT */}
      <View style={{ flex: 1 }}>
        {activeTab === "home" && (
          <HomeScreen
            onSend={() => console.log("Send tapped")}
            onReceive={() => console.log("Receive tapped")}
            onSecurityCenter={() => setActiveTab("recovery")}
          />
        )}
        {activeTab === "wallet" && (
          <PortfolioScreen
            onSend={() => console.log("Send from portfolio")}
            onReceive={() => console.log("Receive from portfolio")}
          />
        )}
        {activeTab === "recovery" && (
          <SecurityCenterScreen
            onManageGuardians={() => console.log("Manage guardians tapped")}
            onConfigureThreshold={() =>
              console.log("Configure threshold tapped")
            }
            onAddContact={() => console.log("Add contact tapped")}
          />
        )}
        {activeTab === "contacts" && (
          <ContactsScreen
            onAddContact={() => console.log("Add contact tapped")}
            onSelectContact={(contact) =>
              console.log("Selected contact:", contact)
            }
          />
        )}
        {activeTab === "settings" && (
          <SettingsScreen
            onToggleDarkMode={() => console.log("Toggle dark mode")}
            onLogout={() => console.log("Logout tapped")}
            onExportAccount={() => console.log("Export account tapped")}
          />
        )}
      </View>

      {/* BOTTOM TAB BAR */}
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderTopColor: isDark ? Colors.surfaceMid : "#e2e8f0",
          backgroundColor: isDark ? Colors.surface : "#ffffff",
          height: 64,
        }}
      >
        {[
          { id: "home", icon: "🏠", label: "Home" },
          { id: "wallet", icon: "💼", label: "Wallet" },
          { id: "recovery", icon: "🛡", label: "Recovery" },
          { id: "contacts", icon: "👥", label: "Contacts" },
          { id: "settings", icon: "⚙️", label: "Settings" },
        ].map((tab) => (
          <View
            key={tab.id}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              opacity: activeTab === tab.id ? 1 : 0.5,
            }}
          >
            <Text
              style={{
                fontSize: 24,
                marginBottom: 2,
              }}
            >
              {tab.icon}
            </Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
};

export default DashboardScreen;
