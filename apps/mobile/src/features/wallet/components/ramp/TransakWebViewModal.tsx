import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

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
  const [loading, setLoading] = useState(true);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      const eventId: string = msg.event_id || msg.eventName || "";
      onOrderEvent(eventId, msg.data ?? {});
      if (
        eventId === "TRANSAK_WIDGET_CLOSE_REQUEST" ||
        eventId === "TRANSAK_WIDGET_CLOSE"
      ) {
        onClose();
      }
    } catch {
      // non-JSON postMessage — ignore
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Feather name="x" size={24} color="#111" />
          </TouchableOpacity>
        </View>

        <WebView
          source={{ uri: url }}
          onMessage={handleMessage}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          style={styles.webview}
        />

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6C47FF" />
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    height: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  closeBtn: { width: 44, height: 44, justifyContent: "center" },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
