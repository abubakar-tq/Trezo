import { useTabContentBottomInset } from "@hooks";
import { Feather } from "@expo/vector-icons";
import { TabScreenContainer } from "@shared/components";
import {
  isUrl,
  toDestination,
  useBrowserStore,
  type BrowserTab,
} from "@store/useBrowserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { DiscoverHome } from "../components/discover/DiscoverHome";
import { INJECTED_PROVIDER_SCRIPT } from "@features/browser/web/injectedProvider.template";
import { handleRPC } from "@features/browser/web/rpcRouter";
import { useDAppSessionsStore } from "@features/browser/store/useDAppSessionsStore";
import {
  ApproveConnectionSheet,
  type ApproveHandle,
} from "@features/browser/components/dapp/ApproveConnectionSheet";
import {
  SignMessageSheet,
  type SignMessageHandle,
} from "@features/browser/components/dapp/SignMessageSheet";
import {
  SignTypedDataSheet,
  type SignTypedDataHandle,
} from "@features/browser/components/dapp/SignTypedDataSheet";
import {
  SendTransactionSheet,
  type SendTransactionHandle,
} from "@features/browser/components/dapp/SendTransactionSheet";
import {
  SwitchChainSheet,
  type SwitchChainHandle,
} from "@features/browser/components/dapp/SwitchChainSheet";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useUserStore } from "@store/useUserStore";

export default function BrowserScreen() {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = useTabContentBottomInset(-28);

  // EIP-1193 approval sheet refs
  const approveRef = useRef<ApproveHandle>(null);
  const signMessageRef = useRef<SignMessageHandle>(null);
  const signTypedDataRef = useRef<SignTypedDataHandle>(null);
  const sendTxRef = useRef<SendTransactionHandle>(null);
  const switchChainRef = useRef<SwitchChainHandle>(null);

  // Source the smart-account address for dApp sessions
  const aaAccount = useWalletStore((s) => s.aaAccount);
  const smartAccountAddress = useUserStore((s) => s.smartAccountAddress);
  const accountAddress = (aaAccount?.predictedAddress ?? smartAccountAddress ?? null) as `0x${string}` | null;

  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const settings = useBrowserStore((state) => state.settings);
  const addTab = useBrowserStore((state) => state.addTab);
  const removeTab = useBrowserStore((state) => state.removeTab);
  const updateTab = useBrowserStore((state) => state.updateTab);
  const setActiveTab = useBrowserStore((state) => state.setActiveTab);
  const addToHistory = useBrowserStore((state) => state.addToHistory);

  const webRefs = useRef<Map<string, WebView>>(new Map());
  const [text, setText] = useState<string>("");
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [showHome, setShowHome] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    if (tabs.length === 0) {
      addTab();
      setShowHome(true);
    }
  }, [tabs.length, addTab]);

  useEffect(() => {
    if (activeTab) setText(activeTab.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id, activeTab?.url]);

  const onSubmit = useCallback(() => {
    if (!text.trim() || !activeTabId) return;
    const dest = toDestination(text, settings.searchEngine);
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
    if (newTabId) setShowHome(true);
  }, [addTab]);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      removeTab(tabId);
      webRefs.current.delete(tabId);
      if (tabs.length <= 1) setShowHome(true);
    },
    [removeTab, tabs.length],
  );

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setShowTabSwitcher(false);
      setShowHome(false);
    },
    [setActiveTab],
  );

  // Shared helper: load a URL in the active (or new) tab and exit home.
  const openUrl = useCallback(
    (url: string) => {
      if (!activeTabId) {
        const newTabId = addTab(url);
        if (newTabId) setShowHome(false);
      } else {
        updateTab(activeTabId, { url, title: url });
        setShowHome(false);
      }
    },
    [activeTabId, addTab, updateTab],
  );

  return (
    <TabScreenContainer style={styles.safeArea}>
      {/* ── Header ──────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.borderMuted }]}>
        {/* Tab strip */}
        {tabs.length > 0 && (
          <View style={styles.tabStrip}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabStripContent}
              style={styles.tabStripScroll}
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
            <View style={styles.tabActions}>
              <TouchableOpacity
                style={[styles.tabAction, { backgroundColor: `${colors.accent}1A`, borderColor: `${colors.accent}33` }]}
                onPress={handleNewTab}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={15} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabAction, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={() => setShowTabSwitcher(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabCount, { color: colors.textPrimary }]}>{tabs.length}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* URL Bar */}
        <View style={[styles.urlBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Feather
            name={showHome ? "compass" : isUrl(text) ? "lock" : "search"}
            size={15}
            color={isUrl(text) ? colors.success : colors.textMuted}
          />
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={onSubmit}
            onFocus={() => setShowHome(false)}
            placeholder="Search or enter URL..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.select({ ios: "url", default: "default" })}
            returnKeyType="go"
            style={[styles.urlInput, { color: colors.textPrimary }]}
          />
          <View style={styles.navBtns}>
            <NavBtn icon="chevron-left" onPress={goBack} disabled={!canGoBack} colors={colors} />
            <NavBtn icon="chevron-right" onPress={goForward} disabled={!canGoForward} colors={colors} />
            <NavBtn icon={loading ? "x" : "rotate-cw"} onPress={reload} colors={colors} />
          </View>
        </View>

        {/* Progress */}
        {loading && (
          <View style={[styles.progressTrack, { backgroundColor: colors.borderMuted }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
        )}
      </View>

      {/* ── Content ─────────────────────────────────── */}
      <View
        style={[
          styles.webShell,
          { borderColor: colors.border, backgroundColor: colors.surfaceCard, marginBottom: bottomInset },
        ]}
      >
        {showHome ? (
          <DiscoverHome
            onSubmitSearch={(intent) => {
              if (intent.kind === "url") {
                openUrl(intent.value);
              } else if (intent.kind === "ticker") {
                openUrl(`https://www.coingecko.com/en/search?query=${encodeURIComponent(intent.value)}`);
              } else {
                openUrl(`https://www.google.com/search?q=${encodeURIComponent(intent.value)}`);
              }
            }}
            onOpenTabs={() => setShowTabSwitcher(true)}
            onTokenPress={(id) => openUrl(`https://www.coingecko.com/en/coins/${id}`)}
            onSitePress={openUrl}
          />
        ) : (
          tabs.map((tab) => (
            <View
              key={tab.id}
              style={[styles.webViewContainer, { display: tab.id === activeTabId ? "flex" : "none" }]}
            >
              <WebView
                ref={(ref) => { if (ref) webRefs.current.set(tab.id, ref); }}
                source={{ uri: tab.url }}
                injectedJavaScriptBeforeContentLoaded={INJECTED_PROVIDER_SCRIPT}
                onMessage={(event) => {
                  if (tab.id !== activeTabId) return;
                  let msg: { type?: string; id?: string; method?: string; params?: unknown[] };
                  try {
                    msg = JSON.parse(event.nativeEvent.data);
                  } catch {
                    return;
                  }
                  if (msg?.type !== "rpc" || !msg.id || !msg.method) return;

                  let origin: string;
                  try {
                    origin = new URL(tab.url).origin;
                  } catch {
                    origin = tab.url;
                  }

                  const webview = webRefs.current.get(tab.id) ?? null;

                  handleRPC(
                    {
                      webview,
                      origin,
                      requestApproval: async (o, chainId) => {
                        const ok = await approveRef.current?.ask(o);
                        if (!ok) return null;
                        if (!accountAddress) return null;
                        return useDAppSessionsStore
                          .getState()
                          .addSession({ origin: o, accountAddress, chainId });
                      },
                      requestSignMessage: async (o, hex) => {
                        const ok = await signMessageRef.current?.ask(o, hex);
                        if (!ok) return null;
                        // TODO(browser/signing-v2): wire personal_sign into the passkey pipeline.
                        // PasskeyService.signWithPasskey is designed for UserOp hashes (bytes32),
                        // not arbitrary personal_sign messages. A separate "sign arbitrary message"
                        // entry-point needs to be added to the signing pipeline before this can
                        // be wired up. For v1, the approval UX is functional; the signature is null.
                        return null;
                      },
                      requestSignTypedData: async (o, td) => {
                        const ok = await signTypedDataRef.current?.ask(o, td);
                        if (!ok) return null;
                        // TODO(browser/signing-v2): wire eth_signTypedData_v4 into the passkey
                        // pipeline once an arbitrary-message signing path exists.
                        return null;
                      },
                      requestSendTransaction: async (o, tx) => {
                        const ok = await sendTxRef.current?.ask(o, tx);
                        if (!ok) return null;
                        // TODO(browser/signing-v2): wire eth_sendTransaction through the AA
                        // UserOp pipeline (buildUserOp → signWithPasskey → sendUserOp).
                        return null;
                      },
                      requestSwitchChain: async (o, chainId) => {
                        const ok = await switchChainRef.current?.ask(o, chainId);
                        if (!ok) return false;
                        useDAppSessionsStore.getState().updateSessionChain(o, chainId);
                        return true;
                      },
                    },
                    {
                      type: "rpc",
                      id: msg.id,
                      method: msg.method,
                      params: msg.params ?? [],
                    },
                  );
                }}
                onNavigationStateChange={(nav) => {
                  if (tab.id === activeTabId) {
                    setCanGoBack(nav.canGoBack);
                    setCanGoForward(nav.canGoForward);
                    if (nav.url && nav.url !== tab.url) {
                      updateTab(tab.id, { url: nav.url, title: nav.title || nav.url });
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

      {/* EIP-1193 dApp approval sheets */}
      <ApproveConnectionSheet ref={approveRef} />
      <SignMessageSheet ref={signMessageRef} />
      <SignTypedDataSheet ref={signTypedDataRef} />
      <SendTransactionSheet ref={sendTxRef} />
      <SwitchChainSheet ref={switchChainRef} />
    </TabScreenContainer>
  );
}

// ── Tab Pill ──────────────────────────────────────────────────────────────────

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
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1,
        gap: 7,
        minWidth: 90,
        maxWidth: 160,
        backgroundColor: isActive ? `${colors.accent}1A` : colors.surfaceElevated,
        borderColor: isActive ? `${colors.accent}66` : colors.border,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "600",
          flex: 1,
          color: isActive ? colors.accent : colors.textSecondary,
        }}
        numberOfLines={1}
      >
        {tab.title.length > 16 ? `${tab.title.substring(0, 16)}…` : tab.title}
      </Text>
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); onClose(); }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Feather name="x" size={12} color={isActive ? colors.accent : colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Nav Button ────────────────────────────────────────────────────────────────

function NavBtn({
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
      style={{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1 }}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Feather name={icon} size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

// ── Tab Switcher Modal ────────────────────────────────────────────────────────

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
  const s = useMemo(() => createModalStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { borderBottomColor: colors.borderMuted }]}>
          <View>
            <Text style={[s.title, { color: colors.textPrimary }]}>Open Tabs</Text>
            <Text style={[s.subtitle, { color: colors.textMuted }]}>
              {tabs.length} tab{tabs.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.closeBtn, { backgroundColor: colors.surfaceElevated }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Feather name="x" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.grid}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                s.tabCard,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: tab.id === activeTabId ? colors.accent : colors.border,
                  borderWidth: tab.id === activeTabId ? 2 : 1,
                },
              ]}
              onPress={() => onSelectTab(tab.id)}
              activeOpacity={0.8}
            >
              <View style={[s.tabPreview, { backgroundColor: colors.surfaceCard }]}>
                <Feather name="globe" size={28} color={`${colors.accent}40`} />
              </View>
              <View style={s.tabMeta}>
                <Text style={[s.tabTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {tab.title}
                </Text>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={[s.tabUrl, { color: colors.textMuted }]} numberOfLines={1}>
                {tab.url}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[s.newTabCard, { backgroundColor: `${colors.accent}0D`, borderColor: `${colors.accent}26` }]}
            onPress={() => { onNewTab(); onClose(); }}
            activeOpacity={0.7}
          >
            <View style={[s.newTabIcon, { backgroundColor: colors.accent }]}>
              <Feather name="plus" size={22} color={colors.textOnAccent} />
            </View>
            <Text style={[s.newTabText, { color: colors.textPrimary }]}>New Tab</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 8,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tabStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    tabStripScroll: { flex: 1 },
    tabStripContent: { gap: 6, paddingRight: 4 },
    tabActions: { flexDirection: "row", gap: 6 },
    tabAction: {
      width: 30,
      height: 30,
      borderRadius: 9,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    tabCount: { fontSize: 13, fontWeight: "700" },
    urlBar: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      paddingLeft: 12,
      paddingRight: 4,
      paddingVertical: Platform.select({ ios: 10, default: 8 }),
      gap: 8,
    },
    urlInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
    },
    navBtns: { flexDirection: "row", alignItems: "center" },
    progressTrack: {
      height: 2,
      width: "100%",
      borderRadius: 1,
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: 1 },
    webShell: {
      flex: 1,
      marginHorizontal: 10,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
    },
    webViewContainer: { flex: 1 },
    webView: { flex: 1 },
  });
}

function createModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
    subtitle: { fontSize: 13, fontWeight: "500", marginTop: 2 },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    grid: { padding: 20, gap: 14 },
    tabCard: {
      borderRadius: 18,
      overflow: "hidden",
    },
    tabPreview: {
      height: 90,
      alignItems: "center",
      justifyContent: "center",
    },
    tabMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 4,
    },
    tabTitle: { fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
    tabUrl: {
      fontSize: 11,
      fontWeight: "500",
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    newTabCard: {
      height: 130,
      borderRadius: 18,
      borderWidth: 1.5,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    newTabIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    newTabText: { fontSize: 15, fontWeight: "700" },
  });
}
