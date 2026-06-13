import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";

// A real-browser desktop-ish UA — Transak gates some payment-form features behind
// its mobile/desktop detection and refuses to render inside lean RN WebView UAs.
const USER_AGENT = Platform.OS === "android"
  ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
  : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

// All Transak widget postMessage event names (verified from official SDK source)
const TRANSAK_EVENTS = {
  INITIALISED: "TRANSAK_WIDGET_INITIALISED",
  OPEN: "TRANSAK_WIDGET_OPEN",
  ORDER_CREATED: "TRANSAK_ORDER_CREATED",
  ORDER_SUCCESSFUL: "TRANSAK_ORDER_SUCCESSFUL",
  ORDER_CANCELLED: "TRANSAK_ORDER_CANCELLED",
  ORDER_FAILED: "TRANSAK_ORDER_FAILED",
  WALLET_REDIRECTION: "TRANSAK_WALLET_REDIRECTION",
  CLOSE: "TRANSAK_WIDGET_CLOSE",
} as const;

// Bridge window.postMessage to window.ReactNativeWebView.postMessage
// Transak widget uses window.postMessage; React Native WebView needs ReactNativeWebView.postMessage
const INJECTED_JS = `
  (function() {
    if (window.ReactNativeWebView) {
      var _origPostMessage = window.postMessage;
      window.postMessage = function(data, targetOrigin, transfer) {
        _origPostMessage.apply(window, arguments);
        try {
          var str = typeof data === 'string' ? data : JSON.stringify(data);
          window.ReactNativeWebView.postMessage(str);
        } catch(e) {}
      };
    }
    true;
  })();
`;

interface Props {
  visible: boolean;
  url: string;
  onClose: () => void;
  onOrderEvent: (eventId: string, data: any) => void;
}

export const TransakWebViewModal: React.FC<Props> = ({
  visible,
  url,
  onClose,
  onOrderEvent,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (visible && url) {
      console.log("[TransakWebView] opening URL:", url);
      setLoading(true);
      setLoadError(false);
    }
  }, [visible, url]);

  const handleNavStateChange = (nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  };

  const handleBack = () => {
    if (canGoBack) {
      webViewRef.current?.goBack();
    } else {
      onClose();
    }
  };

  const handleReload = () => {
    setLoadError(false);
    setLoading(true);
    webViewRef.current?.reload();
  };

  const openExternally = async () => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch (err) {
      console.warn("[TransakWebView] external open failed:", err);
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const raw = event.nativeEvent.data;
      const msg = JSON.parse(raw);
      // Transak sends event id in different field names depending on version
      const eventId: string =
        msg.event_id || msg.eventID || msg.eventName || msg.type || "";

      if (!eventId) return;

      const data = msg.data ?? {};
      onOrderEvent(eventId, data);

      if (
        eventId === TRANSAK_EVENTS.CLOSE ||
        eventId === "TRANSAK_WIDGET_CLOSE_REQUEST"
      ) {
        onClose();
      }
    } catch {
      // non-JSON postMessage (e.g. from 3rd-party scripts inside widget) — ignore
    }
  };

  const handleLoadEnd = () => setLoading(false);
  const handleError = () => {
    setLoading(false);
    setLoadError(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <TouchableOpacity onPress={handleBack} style={styles.iconBtn} hitSlop={8}>
            <Feather
              name={canGoBack ? "chevron-left" : "x"}
              size={22}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Buy Crypto
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleReload} style={styles.iconBtn} hitSlop={8}>
              <Feather name="rotate-cw" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openExternally} style={styles.iconBtn} hitSlop={8}>
              <Feather name="external-link" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Staging notice */}
        <View style={[styles.stagingBanner, { backgroundColor: `${colors.warning}22` }]}>
          <Text style={[styles.stagingText, { color: colors.warning }]}>
            TESTNET — Card 4242 4242 4242 4242 · Exp 10/33 · CVV 100 · 3DS: Checkout1!
          </Text>
        </View>

        {/* WebView — stays fully in-app. All these props are required for the
            Transak payment flow: third-party cookies (session), user-agent
            (Transak gates features on UA), multi-window (3DS card auth opens
            popups), camera/geolocation (KYC), file upload (KYC docs). */}
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onHttpError={handleError}
          onNavigationStateChange={handleNavStateChange}
          injectedJavaScript={INJECTED_JS}
          userAgent={USER_AGENT}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          cacheEnabled
          originWhitelist={["*"]}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsBackForwardNavigationGestures
          allowsFullscreenVideo
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          geolocationEnabled
          mixedContentMode={Platform.OS === "android" ? "always" : undefined}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically
          style={[styles.webview, { backgroundColor: "#FFFFFF" }]}
          startInLoadingState={false}
        />

        {/* Loading overlay */}
        {loading && !loadError && (
          <View
            style={[
              styles.overlay,
              { backgroundColor: colors.background },
            ]}
          >
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading Transak…
            </Text>
          </View>
        )}

        {/* Error state */}
        {loadError && (
          <View style={[styles.overlay, { backgroundColor: colors.background }]}>
            <Feather name="wifi-off" size={40} color={colors.textMuted} />
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>
              Failed to load
            </Text>
            <Text style={[styles.errorSub, { color: colors.textMuted }]}>
              Check your internet connection or open Transak in your browser.
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.accent }]}
              onPress={handleReload}
            >
              <Text style={[styles.retryText, { color: colors.textOnAccent }]}>
                Retry
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.surfaceMuted, marginTop: 8 }]}
              onPress={openExternally}
            >
              <Text style={[styles.retryText, { color: colors.textPrimary }]}>
                Open in browser
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: "transparent", marginTop: 4 }]}
              onPress={onClose}
            >
              <Text style={[styles.retryText, { color: colors.textMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  iconBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  stagingBanner: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  stagingText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  webview: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    top: 52 + 28, // below header + banner
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14, fontWeight: "500", marginTop: 8 },
  errorText: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  errorSub: { fontSize: 14, fontWeight: "400", textAlign: "center", paddingHorizontal: 32 },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { fontSize: 15, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
});
