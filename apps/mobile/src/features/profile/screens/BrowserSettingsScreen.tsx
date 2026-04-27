import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import React, { useCallback, useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBrowserStore } from "@store/useBrowserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { MeshBackground } from "@shared/components";

export default function BrowserSettingsScreen() {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const isDark = resolvedMode === 'dark';
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();

  const settings = useBrowserStore((state) => state.settings);
  const updateSettings = useBrowserStore((state) => state.updateSettings);
  const clearHistory = useBrowserStore((state) => state.clearHistory);
  const closeAllTabs = useBrowserStore((state) => state.closeAllTabs);
  const historyCount = useBrowserStore((state) => state.history.length);
  const tabCount = useBrowserStore((state) => state.tabs.length);

  // Modal states
  const [showHistoryLimitModal, setShowHistoryLimitModal] = useState(false);
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [showSearchEngineModal, setShowSearchEngineModal] = useState(false);
  const [showCloseTabsModal, setShowCloseTabsModal] = useState(false);
  
  // Temporary history limit state
  const [tempHistoryLimit, setTempHistoryLimit] = useState(settings.historyLimit);
  const [historyLimitInput, setHistoryLimitInput] = useState(String(settings.historyLimit));

  const handleTogglePersistTabs = useCallback(
    (value: boolean) => {
      if (!value && tabCount > 0) {
        setShowCloseTabsModal(true);
      } else {
        updateSettings({ persistTabs: value });
      }
    },
    [updateSettings, tabCount]
  );

  const handleConfirmCloseAllTabs = useCallback(() => {
    updateSettings({ persistTabs: false });
    closeAllTabs();
    setShowCloseTabsModal(false);
  }, [updateSettings, closeAllTabs]);

  const handleCancelCloseAllTabs = useCallback(() => {
    setShowCloseTabsModal(false);
  }, []);

  const handleOpenHistoryLimitModal = useCallback(() => {
    setTempHistoryLimit(settings.historyLimit);
    setHistoryLimitInput(String(settings.historyLimit));
    setShowHistoryLimitModal(true);
  }, [settings.historyLimit]);

  const handleSaveHistoryLimit = useCallback(() => {
    const limit = Math.min(Math.max(parseInt(historyLimitInput, 10) || 30, 10), 100);
    updateSettings({ historyLimit: limit });
    setShowHistoryLimitModal(false);
  }, [historyLimitInput, updateSettings]);

  const handleHistoryLimitSliderChange = useCallback((value: number) => {
    setTempHistoryLimit(value);
    setHistoryLimitInput(String(value));
  }, []);

  const handleHistoryLimitInputChange = useCallback((text: string) => {
    const numericOnly = text.replace(/[^0-9]/g, "");
    setHistoryLimitInput(numericOnly);
    const value = parseInt(numericOnly, 10);
    if (!isNaN(value)) {
      setTempHistoryLimit(Math.min(Math.max(value, 10), 100));
    }
  }, []);

  const handleClearHistory = useCallback(() => {
    if (historyCount === 0) {
      return;
    }
    setShowClearHistoryModal(true);
  }, [historyCount]);

  const handleConfirmClearHistory = useCallback(() => {
    clearHistory();
    setShowClearHistoryModal(false);
  }, [clearHistory]);

  const handleSelectSearchEngine = useCallback(
    (engine: "web3compass-duckduckgo" | "duckduckgo" | "google") => {
      updateSettings({ searchEngine: engine });
      setShowSearchEngineModal(false);
    },
    [updateSettings]
  );

  const searchEngineLabel = useMemo(() => {
    switch (settings.searchEngine) {
      case "web3compass-duckduckgo":
        return "Web3Compass + DuckDuckGo";
      case "duckduckgo":
        return "DuckDuckGo";
      case "google":
        return "Google";
      default:
        return "Unknown";
    }
  }, [settings.searchEngine]);

  return (
    <View style={styles.container}>
      <MeshBackground intensity={isDark ? 0.3 : 0.8} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerIndicator} />
        <Text style={[styles.headerKicker, { color: colors.accent }]}>GALACTIC CONFIGURATION</Text>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>BROWSER CORE</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Tabs Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TAB QUANTUM STATE</Text>
          </View>

          <View style={styles.glassCard}>
            <SettingRow
              icon="layers"
              label="Persist Tabs"
              description="Keep tabs open between sessions"
              colors={colors}
              rightElement={
                <Switch
                  value={settings.persistTabs}
                  onValueChange={handleTogglePersistTabs}
                  trackColor={{
                    false: withAlpha(colors.textMuted, 0.2),
                    true: colors.accent,
                  }}
                  thumbColor="#ffffff"
                />
              }
            />

            {tabCount > 0 && (
              <View style={[styles.infoBox, { backgroundColor: withAlpha(colors.accent, 0.08) }]}>
                <Feather name="info" size={14} color={colors.accent} />
                <Text style={[styles.infoText, { color: colors.accent }]}>
                  {tabCount} active tab{tabCount === 1 ? "" : "s"} detected
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Search Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NAVIGATION ENGINE</Text>
          </View>

          <View style={styles.glassCard}>
            <SettingRow
              icon="search"
              label="Search Engine"
              description={searchEngineLabel}
              colors={colors}
              onPress={() => setShowSearchEngineModal(true)}
              showChevron
            />
          </View>

          <View style={[styles.helpBox, { backgroundColor: withAlpha(colors.accent, 0.05) }]}>
            <Feather name="shield" size={14} color={colors.accent} />
            <Text style={[styles.helpText, { color: colors.textSecondary }]}>
              <Text style={{ fontWeight: "800", color: colors.accent }}>Hybrid Mode:</Text> Uses Web3Compass for dApp
              discovery and DuckDuckGo for general privacy searches.
            </Text>
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SECURITY PROTOCOLS</Text>
          </View>

          <View style={styles.glassCard}>
            <SettingRow
              icon="clock"
              label="History Limit"
              description={`Storing up to ${settings.historyLimit} entries`}
              colors={colors}
              onPress={handleOpenHistoryLimitModal}
              showChevron
            />

            <View style={[styles.divider, { backgroundColor: colors.borderMuted }]} />

            <SettingRow
              icon="trash-2"
              label="Clear History"
              description={`${historyCount} session entries stored`}
              colors={colors}
              onPress={handleClearHistory}
              showChevron
            />
            
            <View style={[styles.divider, { backgroundColor: colors.borderMuted }]} />
            
            <SettingRow
              icon="database"
              label="Clear Browser Cache"
              description="Free up local storage space"
              colors={colors}
              onPress={() => {}} 
              showChevron
            />
          </View>
        </View>
        
        {/* Dangerous Actions */}
        <TouchableOpacity 
          style={[styles.clearAllButton, { borderColor: withAlpha(colors.danger, 0.3), backgroundColor: withAlpha(colors.danger, 0.05) }]}
          activeOpacity={0.8}
        >
          <Feather name="alert-circle" size={18} color={colors.danger} />
          <Text style={[styles.clearAllText, { color: colors.danger }]}>CLEAR ALL BROWSING DATA</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* History Limit Modal */}
      <Modal
        visible={showHistoryLimitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHistoryLimitModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowHistoryLimitModal(false)}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: isDark ? '#121212' : '#FFFFFF', borderColor: colors.border }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>History Limit</Text>
              <Pressable onPress={() => setShowHistoryLimitModal(false)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Define the maximum storage for your Web3 exploration history.
            </Text>

            <View style={styles.sliderContainer}>
              <View style={styles.sliderLabelRow}>
                <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>10</Text>
                <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>100</Text>
              </View>
              
              <Slider
                style={styles.slider}
                minimumValue={10}
                maximumValue={100}
                step={5}
                value={tempHistoryLimit}
                onValueChange={handleHistoryLimitSliderChange}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={withAlpha(colors.textMuted, 0.1)}
                thumbTintColor={colors.accent}
              />

              <View style={[styles.inputContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.background }]}>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={historyLimitInput}
                  onChangeText={handleHistoryLimitInputChange}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>ENTRIES</Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}
                onPress={() => setShowHistoryLimitModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.accent }]}
                onPress={handleSaveHistoryLimit}
              >
                <Text style={[styles.modalButtonText, { color: "#000" }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Search Engine Modal */}
      <Modal
        visible={showSearchEngineModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSearchEngineModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSearchEngineModal(false)}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: isDark ? '#121212' : '#FFFFFF', borderColor: colors.border }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Search Engine</Text>
              <Pressable onPress={() => setShowSearchEngineModal(false)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.optionsContainer}>
              <SearchOption 
                title="Web3Compass + DuckDuckGo"
                description="Optimized for dApp discovery and high privacy."
                selected={settings.searchEngine === "web3compass-duckduckgo"}
                onPress={() => handleSelectSearchEngine("web3compass-duckduckgo")}
                colors={colors}
              />
              <SearchOption 
                title="DuckDuckGo Only"
                description="Standard privacy-focused web search."
                selected={settings.searchEngine === "duckduckgo"}
                onPress={() => handleSelectSearchEngine("duckduckgo")}
                colors={colors}
              />
              <SearchOption 
                title="Google"
                description="Comprehensive results with standard tracking."
                selected={settings.searchEngine === "google"}
                onPress={() => handleSelectSearchEngine("google")}
                colors={colors}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirmation Modals */}
      <Modal visible={showClearHistoryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, { backgroundColor: isDark ? '#121212' : '#FFFFFF', borderColor: withAlpha(colors.danger, 0.3) }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Purge History?</Text>
              <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                This will permanently delete {historyCount} journey logs. This action is irreversible.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalButton} onPress={() => setShowClearHistoryModal(false)}>
                  <Text style={{ color: colors.textMuted }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.danger }]} onPress={handleConfirmClearHistory}>
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Confirm Purge</Text>
                </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>
    </View>
  );
}

function SearchOption({ title, description, selected, onPress, colors }: any) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      style={[
        styles.optionRow, 
        { 
          backgroundColor: selected ? withAlpha(colors.accent, 0.08) : 'transparent',
          borderColor: selected ? colors.accent : withAlpha(colors.border, 0.1)
        }
      ]}
    >
      <View style={styles.optionLeft}>
        <View style={[styles.radioOuter, { borderColor: selected ? colors.accent : colors.textMuted }]}>
          {selected && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
        </View>
        <View style={{ flex: 1 }}>
           <Text style={[styles.optionTitle, { color: selected ? colors.accent : colors.textPrimary }]}>{title}</Text>
           <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>{description}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SettingRow({ icon, label, description, colors, onPress, showChevron, rightElement }: any) {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={!onPress}
      activeOpacity={0.7}
      style={rowStyles.container}
    >
      <View style={[rowStyles.iconBox, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
        <Feather name={icon} size={18} color={colors.accent} />
      </View>

      <View style={rowStyles.content}>
        <Text style={[rowStyles.label, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[rowStyles.description, { color: colors.textSecondary }]} numberOfLines={1}>{description}</Text>
      </View>

      {rightElement || (showChevron && <Feather name="chevron-right" size={18} color={colors.textMuted} />)}
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      alignItems: 'center',
    },
    headerIndicator: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: withAlpha(colors.accent, 0.3),
      marginBottom: 16,
    },
    headerKicker: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 3,
      marginBottom: 6,
      opacity: 0.8,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: 1.5,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
    },
    section: {
      marginBottom: 28,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
      marginLeft: 4,
    },
    sectionDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 2,
    },
    glassCard: {
      backgroundColor: isDark ? 'rgba(20, 20, 20, 0.7)' : 'rgba(255, 255, 255, 0.85)',
      borderRadius: 32,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
      overflow: "hidden",
    },
    divider: {
      height: 1,
      marginLeft: 60,
    },
    infoBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    infoText: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    helpBox: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderRadius: 20,
      marginTop: 12,
    },
    helpText: {
      fontSize: 13,
      lineHeight: 18,
      flex: 1,
    },
    clearAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 18,
      borderRadius: 24,
      borderWidth: 1,
      marginTop: 10,
      marginBottom: 20,
    },
    clearAllText: {
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 1,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalContent: {
      width: "100%",
      borderRadius: 32,
      padding: 24,
      borderWidth: 1,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "900",
    },
    modalDescription: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 24,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
      marginTop: 24,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 18,
      alignItems: "center",
    },
    modalButtonText: {
      fontSize: 14,
      fontWeight: "900",
      textTransform: 'uppercase',
    },
    sliderContainer: {
      marginVertical: 8,
    },
    sliderLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    sliderLabel: {
      fontSize: 12,
      fontWeight: "800",
    },
    slider: {
      width: "100%",
      height: 40,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 18,
    },
    input: {
      flex: 1,
      fontSize: 24,
      fontWeight: "900",
      textAlign: "center",
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
    },
    optionsContainer: {
      gap: 12,
    },
    optionRow: {
      padding: 18,
      borderRadius: 24,
      borderWidth: 1.5,
    },
    optionLeft: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: "900",
      marginBottom: 4,
    },
    optionDescription: {
      fontSize: 13,
      lineHeight: 18,
    }
  });
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
  }
});
