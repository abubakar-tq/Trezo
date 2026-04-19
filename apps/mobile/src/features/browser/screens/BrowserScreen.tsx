import { useTabContentBottomInset } from "@app/hooks";
import { Feather } from "@expo/vector-icons";
import { TabScreenContainer } from "@shared/components";
import {
  isUrl,
  toDestination,
  useBrowserStore,
  type BrowserFavorite,
  type BrowserHistoryEntry,
  type BrowserTab,
} from "@store/useBrowserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function BrowserScreen() {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = useTabContentBottomInset(-28);

  // Zustand store
  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const favorites = useBrowserStore((state) => state.favorites);
  const history = useBrowserStore((state) => state.history);
  const settings = useBrowserStore((state) => state.settings);
  const addTab = useBrowserStore((state) => state.addTab);
  const removeTab = useBrowserStore((state) => state.removeTab);
  const updateTab = useBrowserStore((state) => state.updateTab);
  const setActiveTab = useBrowserStore((state) => state.setActiveTab);
  const addToHistory = useBrowserStore((state) => state.addToHistory);

  // Local state
  const webRefs = useRef<Map<string, WebView>>(new Map());
  const [text, setText] = useState<string>("");
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [showHome, setShowHome] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Initialize with one tab if empty
  useEffect(() => {
    if (tabs.length === 0) {
      addTab();
      setShowHome(true);
    }
  }, [tabs.length, addTab]);

  // Sync URL bar with active tab
  useEffect(() => {
    if (activeTab) {
      setText(activeTab.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id, activeTab?.url]);

  const onSubmit = useCallback(() => {
    if (!text.trim() || !activeTabId) return;
    const dest = toDestination(text, settings.searchEngine);
    
    // Update active tab
    updateTab(activeTabId, { url: dest, title: dest });
    setText(dest);
    setShowHome(false);
  }, [text, activeTabId, settings.searchEngine, updateTab]);

  const goBack = useCallback(() => {
    if (!activeTabId) return;
    const webView = webRefs.current.get(activeTabId);
    if (webView && canGoBack) webView.goBack();
  }, [activeTabId, canGoBack]);

  const goForward = useCallback(() => {
    if (!activeTabId) return;
    const webView = webRefs.current.get(activeTabId);
    if (webView && canGoForward) webView.goForward();
  }, [activeTabId, canGoForward]);

  const reload = useCallback(() => {
    if (!activeTabId) return;
    const webView = webRefs.current.get(activeTabId);
    if (!webView) return;
    if (loading) webView.stopLoading();
    else webView.reload();
  }, [activeTabId, loading]);

  const handleNewTab = useCallback(() => {
    const newTabId = addTab();
    if (newTabId) {
      setShowHome(true);
    }
  }, [addTab]);

  const handleCloseTab = useCallback((tabId: string) => {
    removeTab(tabId);
    webRefs.current.delete(tabId);
    
    // If no tabs left, show home
    if (tabs.length <= 1) {
      setShowHome(true);
    }
  }, [removeTab, tabs.length]);

  const handleSwitchTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setShowTabSwitcher(false);
    setShowHome(false);
  }, [setActiveTab]);

  const handleFavoriteClick = useCallback((url: string) => {
    if (!activeTabId) {
      const newTabId = addTab(url);
      if (newTabId) {
        setShowHome(false);
      }
    } else {
      updateTab(activeTabId, { url, title: url });
      setShowHome(false);
    }
  }, [activeTabId, addTab, updateTab]);

  const handleHistoryClick = useCallback((url: string) => {
    handleFavoriteClick(url);
  }, [handleFavoriteClick]);

  return (
    <TabScreenContainer style={styles.safeArea}>
      {/* Header with URL bar and controls */}
      <View style={styles.header}>
        {/* Tab bar */}
        {tabs.length > 0 && (
          <View style={styles.tabBar}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabBarContent}
            >
              {tabs.map((tab) => (
                <TabPill
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onPress={() => handleSwitchTab(tab.id)}
                  onClose={() => handleCloseTab(tab.id)}
                  colors={colors}
                />
              ))}
            </ScrollView>
            
            <TouchableOpacity 
              style={[styles.tabBarButton, { backgroundColor: withAlpha(colors.accent, 0.12) }]}
              onPress={handleNewTab}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={18} color={colors.accent} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBarButton, { backgroundColor: withAlpha(colors.textPrimary, 0.08) }]}
              onPress={() => setShowTabSwitcher(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabCount, { color: colors.textPrimary }]}>{tabs.length}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* URL bar */}
        <View
          style={[
            styles.row,
            {
              borderColor: withAlpha(colors.accent, 0.2),
              backgroundColor: withAlpha(colors.surfaceElevated, 0.92),
            },
          ]}
        >
          <TouchableOpacity onPress={() => setShowHome(!showHome)} activeOpacity={0.7}>
            <Feather
              name={showHome ? "home" : isUrl(text) ? "lock" : "search"}
              size={16}
              color={withAlpha(colors.textMuted, 0.85)}
            />
          </TouchableOpacity>
          
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={onSubmit}
            onFocus={() => setShowHome(false)}
            placeholder="Search or paste URL"
            placeholderTextColor={withAlpha(colors.textMuted, 0.6)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.select({ ios: "url", default: "default" })}
            returnKeyType="go"
            style={[styles.input, { color: colors.textPrimary }]}
          />
          <View style={styles.actions}>
            <IconButton icon="chevron-left" onPress={goBack} disabled={!canGoBack} colors={colors} />
            <IconButton icon="chevron-right" onPress={goForward} disabled={!canGoForward} colors={colors} />
            <IconButton icon={loading ? "x" : "refresh-cw"} onPress={reload} colors={colors} />
          </View>
        </View>

        {/* Progress bar */}
        <View
          style={[
            styles.track,
            { backgroundColor: withAlpha(colors.accent, 0.2), opacity: loading ? 1 : 0 },
          ]}
        >
          <View
            style={[
              styles.fill,
              { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: colors.accent },
            ]}
          />
        </View>
      </View>

      {/* Content area */}
      <View
        style={[
          styles.webShell,
          {
            borderColor: withAlpha(colors.borderMuted, 0.6),
            backgroundColor: colors.surfaceCard,
            marginBottom: bottomInset,
          },
        ]}
      >
        {showHome ? (
          <HomeView
            favorites={favorites}
            history={history}
            onFavoritePress={handleFavoriteClick}
            onHistoryPress={handleHistoryClick}
            colors={colors}
          />
        ) : (
          tabs.map((tab) => (
            <View
              key={tab.id}
              style={[
                styles.webViewContainer,
                { display: tab.id === activeTabId ? "flex" : "none" },
              ]}
            >
              <WebView
                ref={(ref) => {
                  if (ref) {
                    webRefs.current.set(tab.id, ref);
                  }
                }}
                source={{ uri: tab.url }}
                onNavigationStateChange={(nav) => {
                  if (tab.id === activeTabId) {
                    setCanGoBack(nav.canGoBack);
                    setCanGoForward(nav.canGoForward);
                    
                    // Update tab title and URL
                    if (nav.url && nav.url !== tab.url) {
                      updateTab(tab.id, { 
                        url: nav.url, 
                        title: nav.title || nav.url 
                      });
                      
                      // Add to history
                      addToHistory(nav.url, nav.title || nav.url);
                    }
                  }
                }}
                onLoadStart={() => tab.id === activeTabId && setLoading(true)}
                onLoadEnd={() => tab.id === activeTabId && setLoading(false)}
                onLoadProgress={(e) => tab.id === activeTabId && setProgress(e.nativeEvent.progress)}
                onShouldStartLoadWithRequest={(req) => {
                  const u = req?.url ?? "";
                  if (!u) return false;
                  if (/^(javascript|data|file|intent):/i.test(u)) return false;
                  return true;
                }}
                applicationNameForUserAgent="TrezoBrowser/1.0"
                startInLoadingState
                style={styles.webView}
              />
            </View>
          ))
        )}
      </View>

      {/* Tab Switcher Modal */}
      <TabSwitcherModal
        visible={showTabSwitcher}
        tabs={tabs}
        activeTabId={activeTabId}
        onClose={() => setShowTabSwitcher(false)}
        onSelectTab={handleSwitchTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        colors={colors}
      />
    </TabScreenContainer>
  );
}

// Tab Pill Component
function TabPill({
  tab,
  isActive,
  onPress,
  onClose,
  colors,
}: {
  tab: BrowserTab;
  isActive: boolean;
  onPress: () => void;
  onClose: () => void;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      style={[
        tabPillStyles.container,
        {
          backgroundColor: isActive 
            ? withAlpha(colors.accent, 0.15) 
            : withAlpha(colors.surfaceElevated, 0.9),
          borderColor: isActive 
            ? colors.accent 
            : withAlpha(colors.borderMuted, 0.4),
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text 
        style={[
          tabPillStyles.title, 
          { color: isActive ? colors.accent : colors.textPrimary }
        ]}
        numberOfLines={1}
      >
        {tab.title.length > 15 ? `${tab.title.substring(0, 15)}...` : tab.title}
      </Text>
      <TouchableOpacity 
        style={tabPillStyles.closeButton} 
        onPress={(e) => {
          e.stopPropagation();
          onClose();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="x" size={14} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// Home View Component
function HomeView({
  favorites,
  history,
  onFavoritePress,
  onHistoryPress,
  colors,
}: {
  favorites: BrowserFavorite[];
  history: BrowserHistoryEntry[];
  onFavoritePress: (url: string) => void;
  onHistoryPress: (url: string) => void;
  colors: ThemeColors;
}) {
  return (
    <ScrollView style={homeStyles.container} contentContainerStyle={homeStyles.content}>
      {/* Favorites */}
      <View style={homeStyles.section}>
        <Text style={[homeStyles.sectionTitle, { color: colors.textMuted }]}>FAVORITES</Text>
        <View style={homeStyles.grid}>
          {favorites.map((fav) => (
            <TouchableOpacity
              key={fav.url}
              style={[homeStyles.favoriteCard, { backgroundColor: colors.surfaceCard }]}
              onPress={() => onFavoritePress(fav.url)}
              activeOpacity={0.7}
            >
              <View style={[homeStyles.favoriteIcon, { backgroundColor: withAlpha(colors.accent, 0.12) }]}>
                <Feather name={fav.icon as any} size={20} color={colors.accent} />
              </View>
              <Text style={[homeStyles.favoriteLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                {fav.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent History */}
      {history.length > 0 && (
        <View style={homeStyles.section}>
          <Text style={[homeStyles.sectionTitle, { color: colors.textMuted }]}>RECENT</Text>
          {history.slice(0, 10).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[homeStyles.historyItem, { backgroundColor: colors.surfaceCard }]}
              onPress={() => onHistoryPress(item.url)}
              activeOpacity={0.7}
            >
              <View style={[homeStyles.historyIcon, { backgroundColor: withAlpha(colors.textPrimary, 0.08) }]}>
                <Feather name="clock" size={16} color={colors.textMuted} />
              </View>
              <View style={homeStyles.historyContent}>
                <Text style={[homeStyles.historyTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[homeStyles.historyUrl, { color: colors.textMuted }]} numberOfLines={1}>
                  {item.url}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// Tab Switcher Modal Component
function TabSwitcherModal({
  visible,
  tabs,
  activeTabId,
  onClose,
  onSelectTab,
  onCloseTab,
  onNewTab,
  colors,
}: {
  visible: boolean;
  tabs: BrowserTab[];
  activeTabId: string | null;
  onClose: () => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  colors: ThemeColors;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[modalStyles.container, { backgroundColor: colors.surface }]}>
        {/* Header */}
        <View style={[modalStyles.header, { borderBottomColor: withAlpha(colors.borderMuted, 0.3) }]}>
          <Text style={[modalStyles.title, { color: colors.textPrimary }]}>
            Tabs ({tabs.length})
          </Text>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
            <Feather name="x" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Tabs Grid */}
        <ScrollView style={modalStyles.scroll} contentContainerStyle={modalStyles.grid}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                modalStyles.tabCard,
                {
                  backgroundColor: colors.surfaceCard,
                  borderColor: tab.id === activeTabId ? colors.accent : withAlpha(colors.borderMuted, 0.3),
                  borderWidth: tab.id === activeTabId ? 2 : 1,
                },
              ]}
              onPress={() => onSelectTab(tab.id)}
              activeOpacity={0.7}
            >
              <View style={modalStyles.tabCardHeader}>
                <Text style={[modalStyles.tabCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {tab.title}
                </Text>
                <TouchableOpacity
                  style={modalStyles.tabCardClose}
                  onPress={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={[modalStyles.tabCardUrl, { color: colors.textMuted }]} numberOfLines={1}>
                {tab.url}
              </Text>
              {tab.id === activeTabId && (
                <View style={[modalStyles.activeBadge, { backgroundColor: colors.accent }]}>
                  <Text style={modalStyles.activeBadgeText}>Active</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}

          {/* New Tab Button */}
          <TouchableOpacity
            style={[modalStyles.newTabCard, { backgroundColor: withAlpha(colors.accent, 0.12), borderColor: colors.accent }]}
            onPress={() => {
              onNewTab();
              onClose();
            }}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={32} color={colors.accent} />
            <Text style={[modalStyles.newTabText, { color: colors.accent }]}>New Tab</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function IconButton({
  icon,
  onPress,
  colors,
  disabled,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  colors: ThemeColors;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        stylesRow.iconButton,
        {
          backgroundColor: withAlpha(colors.textPrimary, 0.06),
          borderColor: withAlpha(colors.textPrimary, 0.12),
          opacity: disabled ? 0.45 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Feather name={icon} size={16} color={colors.textPrimary} />
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1 },
    header: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, gap: 8 },
    tabBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    tabBarContent: {
      gap: 6,
      paddingRight: 8,
    },
    tabBarButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    tabCount: {
      fontSize: 14,
      fontWeight: "700",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: Platform.select({ ios: 8, default: 7 }),
      gap: 8,
    },
    input: { flex: 1, fontSize: 15, fontWeight: "600" },
    actions: { flexDirection: "row", gap: 8, alignItems: "center" },
    track: { height: 3, width: "100%", borderRadius: 999, overflow: "hidden" },
    fill: { height: "100%", borderRadius: 999 },
    webShell: {
      flex: 1,
      marginHorizontal: 8,
      borderRadius: 18,
      overflow: "hidden",
      borderWidth: 1,
    },
    webViewContainer: {
      flex: 1,
    },
    webView: { flex: 1, backgroundColor: colors.surfaceCard },
  });
}

const stylesRow = StyleSheet.create({
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

const tabPillStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    minWidth: 120,
    maxWidth: 180,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  closeButton: {
    padding: 2,
  },
});

const homeStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  favoriteCard: {
    width: (SCREEN_WIDTH - 56) / 4,
    aspectRatio: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  favoriteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  historyContent: {
    flex: 1,
    gap: 4,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  historyUrl: {
    fontSize: 12,
    fontWeight: "500",
  },
});

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  closeButton: {
    padding: 8,
  },
  scroll: {
    flex: 1,
  },
  grid: {
    padding: 16,
    gap: 12,
  },
  tabCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  tabCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tabCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  tabCardClose: {
    padding: 4,
  },
  tabCardUrl: {
    fontSize: 13,
    fontWeight: "500",
  },
  activeBadge: {
    position: "absolute",
    top: 8,
    right: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  newTabCard: {
    height: 140,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newTabText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
