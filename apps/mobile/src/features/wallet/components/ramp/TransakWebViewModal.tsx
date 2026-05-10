import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

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
          <View style={styles.headerLeft} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Buy Crypto
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Feather name="x" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Staging notice */}
        <View style={[styles.stagingBanner, { backgroundColor: `${colors.warning}22` }]}>
          <Text style={[styles.stagingText, { color: colors.warning }]}>
            TESTNET — Test card: 4242 4242 4242 4242 · Any future date · Any CVV
          </Text>
        </View>

        {/* WebView — stays fully in-app */}
        <WebView
          source={{ uri: url }}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          injectedJavaScript={INJECTED_JS}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode={Platform.OS === "android" ? "always" : undefined}
          style={[styles.webview, { backgroundColor: colors.background }]}
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
              Check your internet connection and try again.
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.accent }]}
              onPress={onClose}
            >
              <Text style={[styles.retryText, { color: colors.textOnAccent }]}>
                Close
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
  headerLeft: { width: 44 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  closeBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "flex-end" },
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
});
