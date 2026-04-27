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
  Image,
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
        {/* Tab bar - Slim Majestic */}
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
              style={[styles.tabBarButton, { backgroundColor: withAlpha(colors.accent, 0.1) }]}
              onPress={handleNewTab}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={16} color={colors.accent} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBarButton, { backgroundColor: withAlpha(colors.textPrimary, 0.05) }]}
              onPress={() => setShowTabSwitcher(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabCount, { color: colors.textPrimary }]}>{tabs.length}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Galactic Command Bar */}
        <View
          style={[
            styles.row,
            {
              borderColor: withAlpha(colors.accent, 0.15),
              backgroundColor: withAlpha(colors.surfaceElevated, 0.8),
            },
          ]}
        >
          <View style={styles.urlPrefix}>
            <Feather
              name={showHome ? "compass" : isUrl(text) ? "shield" : "search"}
              size={14}
              color={colors.accent}
            />
          </View>
          
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={onSubmit}
            onFocus={() => setShowHome(false)}
            placeholder="Search the Galaxy..."
            placeholderTextColor={withAlpha(colors.textMuted, 0.5)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.select({ ios: "url", default: "default" })}
            returnKeyType="go"
            style={[styles.input, { color: colors.textPrimary }]}
          />

          <View style={styles.actions}>
            <IconButton icon="arrow-left" onPress={goBack} disabled={!canGoBack} colors={colors} />
            <IconButton icon="arrow-right" onPress={goForward} disabled={!canGoForward} colors={colors} />
            <IconButton icon={loading ? "x" : "rotate-cw"} onPress={reload} colors={colors} />
          </View>
        </View>

        {/* Progress bar - Sleek Cyan line */}
        <View
          style={[
            styles.track,
            { backgroundColor: 'transparent', opacity: loading ? 1 : 0 },
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

// DApp Categories
const DAPPS_CATEGORIES = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'defi', label: 'DeFi', icon: 'bar-chart-2' },
  { id: 'nft', label: 'NFT', icon: 'image' },
  { id: 'games', label: 'Games', icon: 'play' },
  { id: 'social', label: 'Social', icon: 'users' },
  { id: 'tools', label: 'Tools', icon: 'tool' },
];

// Featured DApps
const FEATURED_DAPPS = [
  { id: 'uniswap', name: 'Uniswap', url: 'https://app.uniswap.org', icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png', category: 'defi', desc: 'Decentralized exchange' },
  { id: 'aave', name: 'Aave', url: 'https://app.aave.com', icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2EEAeE/logo.png', category: 'defi', desc: 'Liquidity protocol' },
  { id: 'opensea', name: 'OpenSea', url: 'https://opensea.io', icon: 'https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.png', category: 'nft', desc: 'NFT marketplace' },
  { id: 'lido', name: 'Lido', url: 'https://stake.lido.fi', icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32/logo.png', category: 'defi', desc: 'Liquid staking' },
  { id: 'blur', name: 'Blur', url: 'https://blur.io', icon: 'https://blur.io/favicon.ico', category: 'nft', desc: 'NFT marketplace for pros' },
  { id: '1inch', name: '1inch', url: 'https://app.1inch.io', icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x111111111117dC0aa78b770fA6A738034120C302/logo.png', category: 'defi', desc: 'DEX aggregator' },
];

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
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredDApps = useMemo(() => {
    if (selectedCategory === 'all') return FEATURED_DAPPS;
    return FEATURED_DAPPS.filter(d => d.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <ScrollView 
      style={homeStyles.container} 
      contentContainerStyle={homeStyles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Galactic Title */}
      <View style={homeStyles.galacticHeader}>
        <Text style={[homeStyles.kicker, { color: colors.accent }]}>DISCOVERY ENGINE</Text>
        <Text style={[homeStyles.displayTitle, { color: colors.textPrimary }]}>Galactic Store</Text>
      </View>

      {/* Featured Majestic Card - Hero */}
      <TouchableOpacity
        style={[homeStyles.heroCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.accent }]}
        onPress={() => onFavoritePress('https://app.uniswap.org')}
        activeOpacity={0.9}
      >
        <View style={homeStyles.heroGlow} />
        <View style={homeStyles.heroContent}>
          <View style={homeStyles.heroIconWrap}>
             <Image 
              source={{ uri: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png' }} 
              style={homeStyles.heroIcon} 
            />
          </View>
          <View style={homeStyles.heroTextWrap}>
            <Text style={[homeStyles.heroTitle, { color: colors.textPrimary }]}>Uniswap Protocol</Text>
            <Text style={[homeStyles.heroDesc, { color: colors.textSecondary }]}>
              Experience the pinnacle of decentralized exchange with lightning-fast swaps.
            </Text>
            <View style={[homeStyles.heroBadge, { backgroundColor: withAlpha(colors.accent, 0.2) }]}>
              <Text style={[homeStyles.heroBadgeText, { color: colors.accent }]}>FEATURED NEBULA</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Bento Grid Categories */}
      <View style={homeStyles.section}>
        <Text style={[homeStyles.sectionLabel, { color: colors.textMuted }]}>NAVIGATE REALMS</Text>
        <View style={homeStyles.bentoGrid}>
          <View style={homeStyles.bentoRow}>
             <BentoCard 
              id="defi" 
              label="DeFi" 
              icon="bar-chart-2" 
              colors={colors} 
              onPress={() => setSelectedCategory('defi')}
              active={selectedCategory === 'defi'}
            />
            <BentoCard 
              id="nft" 
              label="NFTs" 
              icon="image" 
              colors={colors} 
              onPress={() => setSelectedCategory('nft')}
              active={selectedCategory === 'nft'}
            />
          </View>
          <View style={homeStyles.bentoRow}>
            <BentoCard 
              id="games" 
              label="Games" 
              icon="play" 
              colors={colors} 
              onPress={() => setSelectedCategory('games')}
              active={selectedCategory === 'games'}
            />
            <BentoCard 
              id="tools" 
              label="Tools" 
              icon="tool" 
              colors={colors} 
              onPress={() => setSelectedCategory('tools')}
              active={selectedCategory === 'tools'}
            />
          </View>
        </View>
      </View>

      {/* DApp List */}
      <View style={homeStyles.section}>
        <View style={homeStyles.sectionHeader}>
          <Text style={[homeStyles.sectionTitle, { color: colors.textPrimary }]}>ACTIVE CONSTELLATIONS</Text>
          <TouchableOpacity onPress={() => setSelectedCategory('all')}>
            <Text style={[homeStyles.seeAll, { color: colors.accent }]}>Show All</Text>
          </TouchableOpacity>
        </View>
        <View style={homeStyles.dappGrid}>
          {filteredDApps.map((dapp) => (
            <TouchableOpacity
              key={dapp.id}
              style={[homeStyles.dappCard, { backgroundColor: colors.surfaceElevated, borderColor: withAlpha(colors.accent, 0.1) }]}
              onPress={() => onFavoritePress(dapp.url)}
              activeOpacity={0.7}
            >
              <View style={[homeStyles.dappIconWrap, { backgroundColor: withAlpha(colors.textPrimary, 0.05) }]}>
                <Image source={{ uri: dapp.icon }} style={homeStyles.dappIcon} />
              </View>
              <View style={homeStyles.dappInfo}>
                <Text style={[homeStyles.dappName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {dapp.name}
                </Text>
                <Text style={[homeStyles.dappDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                  {dapp.desc}
                </Text>
              </View>
              <Feather name="arrow-up-right" size={16} color={colors.accent} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Favorites - Horizon style */}
      {favorites.length > 0 && (
        <View style={homeStyles.section}>
          <Text style={[homeStyles.sectionTitle, { color: colors.textPrimary }]}>FAVORITE SYSTEMS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={homeStyles.favoritesRow}>
            {favorites.map((fav) => (
              <TouchableOpacity
                key={fav.url}
                style={[homeStyles.favPill, { backgroundColor: colors.surfaceElevated, borderColor: withAlpha(colors.accent, 0.2) }]}
                onPress={() => onFavoritePress(fav.url)}
                activeOpacity={0.7}
              >
                <Feather name={fav.icon as any} size={14} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={[homeStyles.favLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                  {fav.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* History - Terminal Log style */}
      {history.length > 0 && (
        <View style={homeStyles.section}>
          <View style={homeStyles.sectionHeader}>
            <Text style={[homeStyles.sectionTitle, { color: colors.textPrimary }]}>RECENT VOYAGES</Text>
            <TouchableOpacity>
              <Text style={[homeStyles.seeAll, { color: colors.textMuted }]}>PURGE LOGS</Text>
            </TouchableOpacity>
          </View>
          <View style={[homeStyles.terminalLog, { backgroundColor: withAlpha(colors.surfaceElevated, 0.5), borderColor: withAlpha(colors.accent, 0.05) }]}>
            {history.slice(0, 5).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={homeStyles.historyItem}
                onPress={() => onHistoryPress(item.url)}
                activeOpacity={0.7}
              >
                <View style={homeStyles.historyIndicator}>
                  <View style={[homeStyles.dot, { backgroundColor: colors.accent }]} />
                  <View style={[homeStyles.line, { backgroundColor: withAlpha(colors.accent, 0.2) }]} />
                </View>
                <View style={homeStyles.historyContent}>
                  <Text style={[homeStyles.historyTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[homeStyles.historyUrl, { color: colors.accent, opacity: 0.6 }]} numberOfLines={1}>
                    {item.url}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// Bento Card Component
function BentoCard({ id, label, icon, colors, onPress, active }: { 
  id: string; 
  label: string; 
  icon: string; 
  colors: ThemeColors; 
  onPress: () => void;
  active: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        homeStyles.bentoCard,
        { 
          backgroundColor: active ? withAlpha(colors.accent, 0.15) : colors.surfaceElevated,
          borderColor: active ? colors.accent : withAlpha(colors.accent, 0.05),
          borderWidth: 1.5
        }
      ]}
    >
      <View style={[homeStyles.bentoIconWrap, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
        <Feather name={icon as any} size={20} color={colors.accent} />
      </View>
      <Text style={[homeStyles.bentoLabel, { color: active ? colors.accent : colors.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
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
      <View style={[modalStyles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={modalStyles.header}>
          <View>
            <Text style={[modalStyles.kicker, { color: colors.accent }]}>MULTIVERSE</Text>
            <Text style={[modalStyles.title, { color: colors.textPrimary }]}>
              Active Tabs
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[modalStyles.closeButton, { backgroundColor: colors.surfaceElevated }]}>
            <Feather name="x" size={20} color={colors.textPrimary} />
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
                  backgroundColor: colors.surfaceElevated,
                  borderColor: tab.id === activeTabId ? colors.accent : withAlpha(colors.accent, 0.05),
                  borderWidth: tab.id === activeTabId ? 2 : 1,
                },
              ]}
              onPress={() => onSelectTab(tab.id)}
              activeOpacity={0.8}
            >
              <View style={modalStyles.tabPreview}>
                 <Feather name="globe" size={32} color={withAlpha(colors.accent, 0.2)} />
              </View>
              <View style={modalStyles.tabInfo}>
                <View style={modalStyles.tabMeta}>
                  <Text style={[modalStyles.tabCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {tab.title}
                  </Text>
                  <TouchableOpacity
                    style={modalStyles.tabCardClose}
                    onPress={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                  >
                    <Feather name="x-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={[modalStyles.tabCardUrl, { color: colors.accent, opacity: 0.5 }]} numberOfLines={1}>
                  {tab.url}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* New Tab Button */}
          <TouchableOpacity
            style={[modalStyles.newTabCard, { backgroundColor: withAlpha(colors.accent, 0.05), borderColor: withAlpha(colors.accent, 0.2) }]}
            onPress={() => {
              onNewTab();
              onClose();
            }}
            activeOpacity={0.7}
          >
            <View style={[modalStyles.plusCircle, { backgroundColor: colors.accent }]}>
              <Feather name="plus" size={24} color="#000" />
            </View>
            <Text style={[modalStyles.newTabText, { color: colors.textPrimary }]}>Open New Portal</Text>
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
      borderRadius: 20,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: Platform.select({ ios: 10, default: 9 }),
      gap: 10,
    },
    input: { 
      flex: 1, 
      fontSize: 15, 
      fontWeight: "600",
      letterSpacing: -0.3
    },
    urlPrefix: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actions: { flexDirection: "row", gap: 6, alignItems: "center" },
    track: { height: 2, width: "100%", overflow: "hidden", marginTop: 4 },
    fill: { height: "100%" },
    webShell: {
      flex: 1,
      marginHorizontal: 12,
      borderRadius: 24,
      overflow: "hidden",
      borderWidth: 1.5,
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
    padding: 24,
    paddingTop: 8,
    paddingBottom: 100,
  },
  galacticHeader: {
    marginBottom: 28,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  displayTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 24,
    marginBottom: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#00FFFF20',
    blurRadius: 50,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 12,
    elevation: 10,
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  heroIcon: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  heroTextWrap: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroDesc: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    opacity: 0.8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  section: {
    marginBottom: 36,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 16,
    opacity: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '800',
  },
  bentoGrid: {
    gap: 12,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    height: 110,
    borderRadius: 20,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  bentoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  dappGrid: {
    gap: 14,
  },
  dappCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
  },
  dappIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dappIcon: {
    width: '60%',
    height: '60%',
    resizeMode: 'contain',
  },
  dappInfo: {
    flex: 1,
    gap: 4,
  },
  dappName: {
    fontSize: 17,
    fontWeight: '700',
  },
  dappDesc: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.6,
  },
  favoritesRow: {
    gap: 12,
  },
  favPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  favLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  terminalLog: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 16,
  },
  historyIndicator: {
    alignItems: 'center',
    width: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  line: {
    width: 2,
    height: 30,
    borderRadius: 1,
  },
  historyContent: {
    flex: 1,
    gap: 4,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  historyUrl: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
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
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
    opacity: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  grid: {
    padding: 24,
    gap: 16,
  },
  tabCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabPreview: {
    height: 120,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInfo: {
    padding: 16,
    gap: 4,
  },
  tabMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  tabCardClose: {
    padding: 4,
  },
  tabCardUrl: {
    fontSize: 12,
    fontWeight: "600",
  },
  newTabCard: {
    height: 180,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  plusCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newTabText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
