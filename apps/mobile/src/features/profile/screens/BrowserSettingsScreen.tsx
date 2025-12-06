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
const HISTORY_LIMITS = [10, 20, 30, 50, 75, 100];

export default function BrowserSettingsScreen() {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Browser Settings</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          Customize your browsing experience
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Tabs Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>TABS</Text>

          <View style={[styles.card, { backgroundColor: colors.surfaceCard }]}>
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
                    false: withAlpha(colors.textMuted, 0.3),
                    true: colors.accent,
                  }}
                  thumbColor="#ffffff"
                />
              }
            />

            {tabCount > 0 && (
              <View style={[styles.infoBox, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
                <Feather name="info" size={14} color={colors.accent} />
                <Text style={[styles.infoText, { color: colors.accent }]}>
                  {tabCount} tab{tabCount === 1 ? "" : "s"} currently open
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* History Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>HISTORY</Text>

          <View style={[styles.card, { backgroundColor: colors.surfaceCard }]}>
            <SettingRow
              icon="clock"
              label="History Limit"
              description={`Store up to ${settings.historyLimit} recent entries`}
              colors={colors}
              onPress={handleOpenHistoryLimitModal}
              showChevron
            />

            <View style={styles.divider} />

            <SettingRow
              icon="trash-2"
              label="Clear History"
              description={`${historyCount} ${historyCount === 1 ? "entry" : "entries"} stored`}
              colors={colors}
              onPress={handleClearHistory}
              showChevron
            />
          </View>
        </View>

        {/* Search Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SEARCH</Text>

          <View style={[styles.card, { backgroundColor: colors.surfaceCard }]}>
            <SettingRow
              icon="search"
              label="Search Engine"
              description={searchEngineLabel}
              colors={colors}
              onPress={() => setShowSearchEngineModal(true)}
              showChevron
            />
          </View>

          <View style={[styles.helpBox, { backgroundColor: withAlpha(colors.textMuted, 0.05) }]}>
            <Feather name="info" size={14} color={colors.textMuted} />
            <Text style={[styles.helpText, { color: colors.textMuted }]}>
              <Text style={{ fontWeight: "700" }}>Hybrid Mode:</Text> Uses Web3Compass for dApp
              discovery (swap, NFT, DeFi terms) and DuckDuckGo for general searches.
            </Text>
          </View>
        </View>
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
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceCard }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                History Limit
              </Text>
              <Pressable
                onPress={() => setShowHistoryLimitModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textMuted }]}>
              Set the maximum number of history entries to store (10-100)
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
                maximumTrackTintColor={withAlpha(colors.textMuted, 0.2)}
                thumbTintColor={colors.accent}
              />

              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: withAlpha(colors.textMuted, 0.05),
                      color: colors.textPrimary,
                      borderColor: withAlpha(colors.textMuted, 0.1),
                    },
                  ]}
                  value={historyLimitInput}
                  onChangeText={handleHistoryLimitInputChange}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="30"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>entries</Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}
                onPress={() => setShowHistoryLimitModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: colors.accent }]}
                onPress={handleSaveHistoryLimit}
              >
                <Text style={[styles.modalButtonText, { color: "#FFFFFF" }]}>
                  Save
                </Text>
              </Pressable>
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
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceCard }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Search Engine
              </Text>
              <Pressable
                onPress={() => setShowSearchEngineModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textMuted }]}>
              Choose your preferred search experience
            </Text>

            <View style={styles.optionsContainer}>
              <Pressable
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: withAlpha(colors.textMuted, 0.05),
                    borderColor:
                      settings.searchEngine === "web3compass-duckduckgo"
                        ? colors.accent
                        : withAlpha(colors.textMuted, 0.1),
                  },
                ]}
                onPress={() => handleSelectSearchEngine("web3compass-duckduckgo")}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor:
                          settings.searchEngine === "web3compass-duckduckgo"
                            ? colors.accent
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {settings.searchEngine === "web3compass-duckduckgo" && (
                      <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />
                    )}
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                      Web3Compass + DuckDuckGo
                    </Text>
                    <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
                      Best for crypto. Web3 for dApps, DuckDuckGo for general searches.
                    </Text>
                  </View>
                </View>
                {settings.searchEngine === "web3compass-duckduckgo" && (
                  <Feather name="check" size={20} color={colors.accent} />
                )}
              </Pressable>

              <Pressable
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: withAlpha(colors.textMuted, 0.05),
                    borderColor:
                      settings.searchEngine === "duckduckgo"
                        ? colors.accent
                        : withAlpha(colors.textMuted, 0.1),
                  },
                ]}
                onPress={() => handleSelectSearchEngine("duckduckgo")}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor:
                          settings.searchEngine === "duckduckgo"
                            ? colors.accent
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {settings.searchEngine === "duckduckgo" && (
                      <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />
                    )}
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                      DuckDuckGo Only
                    </Text>
                    <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
                      Privacy-focused search for all queries.
                    </Text>
                  </View>
                </View>
                {settings.searchEngine === "duckduckgo" && (
                  <Feather name="check" size={20} color={colors.accent} />
                )}
              </Pressable>

              <Pressable
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: withAlpha(colors.textMuted, 0.05),
                    borderColor:
                      settings.searchEngine === "google"
                        ? colors.accent
                        : withAlpha(colors.textMuted, 0.1),
                  },
                ]}
                onPress={() => handleSelectSearchEngine("google")}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor:
                          settings.searchEngine === "google"
                            ? colors.accent
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {settings.searchEngine === "google" && (
                      <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />
                    )}
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                      Google
                    </Text>
                    <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
                      Google search for all queries.
                    </Text>
                  </View>
                </View>
                {settings.searchEngine === "google" && (
                  <Feather name="check" size={20} color={colors.accent} />
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Clear History Confirmation Modal */}
      <Modal
        visible={showClearHistoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearHistoryModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowClearHistoryModal(false)}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceCard }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Clear History?
              </Text>
              <Pressable
                onPress={() => setShowClearHistoryModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textMuted }]}>
              This will permanently delete {historyCount} history{" "}
              {historyCount === 1 ? "entry" : "entries"}.
            </Text>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}
                onPress={() => setShowClearHistoryModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: "#EF4444" }]}
                onPress={handleConfirmClearHistory}
              >
                <Text style={[styles.modalButtonText, { color: "#FFFFFF" }]}>
                  Clear
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Close All Tabs Confirmation Modal */}
      <Modal
        visible={showCloseTabsModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelCloseAllTabs}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleCancelCloseAllTabs}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceCard }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Tab Persistence Disabled
              </Text>
              <Pressable
                onPress={handleCancelCloseAllTabs}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textMuted }]}>
              You have {tabCount} open {tabCount === 1 ? "tab" : "tabs"}. They will be closed when
              you restart the app. Close all tabs now?
            </Text>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}
                onPress={handleCancelCloseAllTabs}
              >
                <Text style={[styles.modalButtonText, { color: colors.textMuted }]}>
                  Keep for Now
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: "#EF4444" }]}
                onPress={handleConfirmCloseAllTabs}
              >
                <Text style={[styles.modalButtonText, { color: "#FFFFFF" }]}>
                  Close All
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  description,
  colors,
  onPress,
  showChevron,
  rightElement,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  description: string;
  colors: ThemeColors;
  onPress?: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
}) {
  const content = (
    <View style={rowStyles.container}>
      <View style={[rowStyles.iconBox, { backgroundColor: withAlpha(colors.accent, 0.12) }]}>
        <Feather name={icon} size={18} color={colors.accent} />
      </View>

      <View style={rowStyles.content}>
        <Text style={[rowStyles.label, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[rowStyles.description, { color: colors.textMuted }]} numberOfLines={2}>
          {description}
        </Text>
      </View>

      {rightElement ? (
        rightElement
      ) : showChevron ? (
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "700",
      marginBottom: 6,
    },
    headerSubtitle: {
      fontSize: 15,
      fontWeight: "500",
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginBottom: 10,
      marginLeft: 4,
    },
    card: {
      borderRadius: 16,
      overflow: "hidden",
    },
    divider: {
      height: 1,
      backgroundColor: withAlpha("#000000", 0.06),
      marginLeft: 58,
    },
    infoBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginTop: 1,
    },
    infoText: {
      fontSize: 13,
      fontWeight: "600",
      flex: 1,
    },
    helpBox: {
      flexDirection: "row",
      gap: 10,
      padding: 12,
      borderRadius: 12,
      marginTop: 8,
    },
    helpText: {
      fontSize: 13,
      lineHeight: 18,
      flex: 1,
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      width: "100%",
      maxWidth: 400,
      borderRadius: 20,
      padding: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
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
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: "700",
    },
    // History Limit Modal Styles
    sliderContainer: {
      marginVertical: 8,
    },
    sliderLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    sliderLabel: {
      fontSize: 13,
      fontWeight: "600",
    },
    slider: {
      width: "100%",
      height: 40,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 16,
    },
    input: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      fontSize: 16,
      fontWeight: "600",
      borderWidth: 1,
      textAlign: "center",
    },
    inputLabel: {
      fontSize: 15,
      fontWeight: "600",
    },
    // Search Engine Modal Styles
    optionsContainer: {
      gap: 12,
      marginTop: 8,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
    },
    optionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    optionTextContainer: {
      flex: 1,
      gap: 4,
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: "700",
    },
    optionDescription: {
      fontSize: 13,
      lineHeight: 18,
    },
  });
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  description: {
    fontSize: 13,
    fontWeight: "500",
  },
});
