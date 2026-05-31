import { useTabContentBottomInset } from "@hooks";
import { Feather } from "@expo/vector-icons";
import { TabScreenContainer } from "@shared/components";
import { toDestination, useBrowserStore, type BrowserTab } from "@store/useBrowserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { WebView } from "react-native-webview";
import { hashMessage, hashTypedData, type Hex } from "viem";
import { DiscoverHome } from "../components/discover/DiscoverHome";
import { BrowserTopBar } from "../components/BrowserTopBar";
import { BrowserMenuSheet, type BrowserMenuHandle } from "../components/BrowserMenuSheet";
import { getHostname } from "../utils/url";
import { decideBrowserBackAction } from "../utils/backAction";
import { INJECTED_PROVIDER_SCRIPT } from "@features/browser/web/injectedProvider.template";
import { handleRPC } from "@features/browser/web/rpcRouter";
import { useDAppSessionsStore } from "@features/browser/store/useDAppSessionsStore";
import { ApproveConnectionSheet, type ApproveHandle } from "@features/browser/components/dapp/ApproveConnectionSheet";
import { SignMessageSheet, type SignMessageHandle } from "@features/browser/components/dapp/SignMessageSheet";
import { SignTypedDataSheet, type SignTypedDataHandle } from "@features/browser/components/dapp/SignTypedDataSheet";
import { SendTransactionSheet, type SendTransactionHandle } from "@features/browser/components/dapp/SendTransactionSheet";
import { SwitchChainSheet, type SwitchChainHandle } from "@features/browser/components/dapp/SwitchChainSheet";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useUserStore } from "@store/useUserStore";
import PasskeyService from "@features/wallet/services/PasskeyService";
import { SmartAccountExecutionService } from "@features/wallet/services/SmartAccountExecutionService";
import { useAccountState } from "@features/wallet/hooks/useAccountState";
import { useActivationSheet } from "@features/wallet/hooks/useActivationSheet";
import { ActivationSheet } from "@features/wallet/components/ActivationSheet";
import { DEFAULT_CHAIN_ID, getChainConfig, SUPPORTED_CHAIN_IDS, type SupportedChainId } from "@/src/integration/chains";

// Best-effort prefers-color-scheme hint so theme-aware sites follow the app theme.
// The guaranteed win is the themed container/WebView background (kills the white flash);
// this is layered on top. Injected before content loads and re-injected on theme toggle.
function buildColorSchemeScript(mode: "light" | "dark"): string {
  return `
(function () {
  try {
    var scheme = ${JSON.stringify(mode)};
    document.documentElement.style.colorScheme = scheme;
    var m = document.querySelector('meta[name="color-scheme"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "color-scheme");
      if (document.head) document.head.appendChild(m);
    }
    m.setAttribute("content", scheme === "dark" ? "dark light" : "light dark");
  } catch (e) {}
})();
true;
`;
}

export default function BrowserScreen() {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = useTabContentBottomInset(-28);
  const navigation = useNavigation<any>();

  // EIP-1193 approval sheet refs
  const approveRef = useRef<ApproveHandle>(null);
  const signMessageRef = useRef<SignMessageHandle>(null);
  const signTypedDataRef = useRef<SignTypedDataHandle>(null);
  const sendTxRef = useRef<SendTransactionHandle>(null);
  const switchChainRef = useRef<SwitchChainHandle>(null);
  const menuRef = useRef<BrowserMenuHandle>(null);

  // Source the smart-account address for dApp sessions
  const aaAccount = useWalletStore((s) => s.aaAccount);
  const smartAccountAddress = useUserStore((s) => s.smartAccountAddress);
  const user = useUserStore((s) => s.user);
  const accountAddress = (aaAccount?.predictedAddress ?? smartAccountAddress ?? null) as `0x${string}` | null;
  const accountState = useAccountState();
  const { ref: activationSheetRef, requireActiveOnChain } = useActivationSheet();

  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const settings = useBrowserStore((state) => state.settings);
  const addTab = useBrowserStore((state) => state.addTab);
  const removeTab = useBrowserStore((state) => state.removeTab);
  const updateTab = useBrowserStore((state) => state.updateTab);
  const setActiveTab = useBrowserStore((state) => state.setActiveTab);
  const addToHistory = useBrowserStore((state) => state.addToHistory);
  const sessions = useDAppSessionsStore((state) => state.sessions);

  const webRefs = useRef<Map<string, WebView>>(new Map());
  const [text, setText] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [showHome, setShowHome] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const colorSchemeScript = useMemo(() => buildColorSchemeScript(resolvedMode), [resolvedMode]);

  const activeOrigin = useMemo(() => {
    if (!activeTab?.url) return "";
    try {
      return new URL(activeTab.url).origin;
    } catch {
      return activeTab.url;
    }
  }, [activeTab?.url]);

  const connected = useMemo(
    () => sessions.some((s) => s.origin === activeOrigin),
    [sessions, activeOrigin],
  );

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

  // Re-inject the color-scheme hint into all live WebViews when the app theme toggles.
  useEffect(() => {
    webRefs.current.forEach((wv) => {
      try {
        wv.injectJavaScript(colorSchemeScript);
      } catch {
        // webview not ready / detached — ignore
      }
    });
  }, [colorSchemeScript]);

  // Intercept Android system/gesture back so it unwinds the in-browser hierarchy
  // (web history → Discover home) before the bottom-tab navigator's default
  // "firstRoute" behavior leaves the tab for Home. Focus-scoped so it never
  // hijacks back on other tabs.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const action = decideBrowserBackAction({
          tabSwitcherOpen: showTabSwitcher,
          editing,
          showHome,
          canGoBack,
        });
        switch (action) {
          case "close-tab-switcher":
            setShowTabSwitcher(false);
            return true;
          case "stop-editing":
            setEditing(false);
            return true;
          case "web-go-back":
            if (activeTabId) webRefs.current.get(activeTabId)?.goBack();
            return true;
          case "show-home":
            setShowHome(true);
            return true;
          default:
            return false; // passthrough → navigator handles it (→ Home tab)
        }
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }, [showTabSwitcher, editing, showHome, canGoBack, activeTabId]),
  );

  const onSubmit = useCallback(() => {
    if (!text.trim() || !activeTabId) return;
    const dest = toDestination(text, settings.searchEngine);
    updateTab(activeTabId, { url: dest, title: dest });
    setText(dest);
    setShowHome(false);
    setEditing(false);
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

  const beginEdit = useCallback(() => {
    setEditing(true);
    if (activeTab) setText(activeTab.url);
  }, [activeTab]);

  const handleCopyLink = useCallback(() => {
    if (activeTab?.url) Clipboard.setStringAsync(activeTab.url);
  }, [activeTab?.url]);

  const handleShare = useCallback(() => {
    if (activeTab?.url) Share.share({ message: activeTab.url }).catch(() => {});
  }, [activeTab?.url]);

  const handleDisconnect = useCallback(() => {
    if (activeOrigin) useDAppSessionsStore.getState().removeSession(activeOrigin);
  }, [activeOrigin]);

  const handleOpenSettings = useCallback(() => {
    navigation.navigate("BrowserSettings");
  }, [navigation]);

  return (
    <TabScreenContainer style={styles.safeArea}>
      {/* ── Slim top bar (browsing only; home uses DiscoverHome's own search) ── */}
      {!showHome && (
        <BrowserTopBar
          url={activeTab?.url ?? ""}
          text={text}
          onChangeText={setText}
          onSubmit={onSubmit}
          editing={editing}
          onBeginEdit={beginEdit}
          onEndEdit={() => setEditing(false)}
          canGoBack={canGoBack}
          onBack={goBack}
          tabCount={tabs.length}
          onOpenTabs={() => setShowTabSwitcher(true)}
          onOpenMenu={() => menuRef.current?.present()}
          colors={colors}
        />
      )}

      {/* Progress */}
      {loading && !showHome && (
        <View style={[styles.progressTrack, { backgroundColor: colors.borderMuted }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: colors.accent },
            ]}
          />
        </View>
      )}

      {/* ── Content (full-bleed, themed background) ─────────────── */}
      <View style={[styles.webShell, { backgroundColor: colors.background, marginBottom: bottomInset }]}>
        {showHome ? (
          <DiscoverHome
            onSubmitSearch={(intent) => {
              if (intent.kind === "url") {
                openUrl(intent.value);
              } else if (intent.kind === "ticker") {
                if (intent.explicit) {
                  // User typed an explicit $TICKER — open the CoinGecko token page.
                  openUrl(`https://www.coingecko.com/en/coins/${intent.value.toLowerCase()}`);
                } else {
                  // Bare word matched the ticker pattern — route through the web3-aware resolver.
                  openUrl(toDestination(intent.value, settings.searchEngine));
                }
              } else {
                // kind === "search": use the configured search engine (web3compass / DDG / Google).
                openUrl(toDestination(intent.value, settings.searchEngine));
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
              style={[
                styles.webViewContainer,
                { backgroundColor: colors.background, display: tab.id === activeTabId ? "flex" : "none" },
              ]}
            >
              <WebView
                ref={(ref) => {
                  if (ref) webRefs.current.set(tab.id, ref);
                }}
                source={{ uri: tab.url }}
                injectedJavaScriptBeforeContentLoaded={INJECTED_PROVIDER_SCRIPT + colorSchemeScript}
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
                      defaultChainId: DEFAULT_CHAIN_ID,
                      findSession: (o) => useDAppSessionsStore.getState().findSession(o),
                      touchSession: (o) => useDAppSessionsStore.getState().touchSession(o),
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
                        if (!ok || !user?.id) return null;
                        // EIP-1271 path: contracts already accept the same WebAuthn encoding for
                        // both validateUserOp and isValidSignatureWithSender (see PasskeyValidator.sol).
                        const messageHash = hashMessage({ raw: hex as Hex });
                        const sig = await PasskeyService.signWithPasskey(user.id, messageHash);
                        return PasskeyService.encodeSignatureForContract(sig) as Hex;
                      },
                      requestSignTypedData: async (o, td) => {
                        const ok = await signTypedDataRef.current?.ask(o, td);
                        if (!ok || !user?.id) return null;
                        const typed = td as {
                          domain: Record<string, unknown>;
                          types: Record<string, Array<{ name: string; type: string }>>;
                          primaryType: string;
                          message: Record<string, unknown>;
                        };
                        const typedHash = hashTypedData({
                          domain: typed.domain,
                          types: typed.types,
                          primaryType: typed.primaryType,
                          message: typed.message,
                        } as Parameters<typeof hashTypedData>[0]);
                        const sig = await PasskeyService.signWithPasskey(user.id, typedHash);
                        return PasskeyService.encodeSignatureForContract(sig) as Hex;
                      },
                      requestSendTransaction: async (o, tx) => {
                        const ok = await sendTxRef.current?.ask(o, tx);
                        if (!ok || !user?.id || !accountAddress) return null;
                        const session = useDAppSessionsStore.getState().findSession(o);
                        if (!session) return null;

                        // Brief Rule (§3.3): "If the user's account is not yet Active on the
                        // request's chain, prompt activation first." Gate via ActivationSheet.
                        const chainId = session.chainId;
                        if (!SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId)) return null;
                        const typedChainId = chainId as SupportedChainId;
                        const isActive = accountState.isActiveOnChain(chainId);
                        const activated = await new Promise<boolean>((resolve) => {
                          requireActiveOnChain(
                            chainId,
                            isActive,
                            () => resolve(true),
                            () => resolve(false),
                          );
                        });
                        if (!activated) return null;

                        // Wrap the dApp tx into a smart-account execute UserOp, sign, submit.
                        // Per ADR-0001: testnets sponsor all UserOps.
                        const chain = getChainConfig(typedChainId);
                        const prepared = await SmartAccountExecutionService.prepareUserOperation(
                          {
                            chainId: typedChainId,
                            account: accountAddress,
                            target: tx.to,
                            value: tx.value ? BigInt(tx.value) : 0n,
                            data: (tx.data ?? "0x") as Hex,
                            operationLabel: "dapp:eth_sendTransaction",
                            riskLevel: "medium",
                          },
                          {
                            userId: user.id,
                            usePaymaster: Boolean(chain?.paymasterUrl),
                            paymasterUrl: chain?.paymasterUrl,
                          },
                        );
                        const signed = await SmartAccountExecutionService.signUserOperation(
                          user.id,
                          prepared,
                        );
                        const submitted = await SmartAccountExecutionService.submitUserOperation(signed);
                        // Per ADR-0002: we return the userOpHash (not a tx hash). Modern
                        // ERC-4337-aware dApps treat the return as opaque and poll the bundler
                        // for the receipt, which exposes the on-chain tx hash.
                        return submitted.submittedUserOpHash as Hex;
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
                style={[styles.webView, { backgroundColor: colors.background }]}
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

      {/* ⋯ menu */}
      <BrowserMenuSheet
        ref={menuRef}
        title={activeTab?.title ?? ""}
        hostname={getHostname(activeTab?.url ?? "")}
        connected={connected}
        canGoForward={canGoForward}
        onReload={reload}
        onForward={goForward}
        onCopyLink={handleCopyLink}
        onShare={handleShare}
        onNewTab={handleNewTab}
        onDisconnect={handleDisconnect}
        onOpenSettings={handleOpenSettings}
        colors={colors}
      />

      {/* EIP-1193 dApp approval sheets */}
      <ApproveConnectionSheet ref={approveRef} />
      <SignMessageSheet ref={signMessageRef} />
      <SignTypedDataSheet ref={signTypedDataRef} />
      <SendTransactionSheet ref={sendTxRef} />
      <SwitchChainSheet ref={switchChainRef} />

      {/* Activation gate for eth_sendTransaction when not Active on session chain */}
      <ActivationSheet ref={activationSheetRef} />
    </TabScreenContainer>
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
                  onPress={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
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
            onPress={() => {
              onNewTab();
              onClose();
            }}
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

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1 },
    progressTrack: {
      height: 2,
      width: "100%",
      borderRadius: 1,
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: 1 },
    webShell: { flex: 1 },
    webViewContainer: { flex: 1 },
    webView: { flex: 1 },
  });
}

function createModalStyles(_colors: ThemeColors) {
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
