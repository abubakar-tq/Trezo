import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ThemedAlertButton = {
  text: string;
  onPress: () => void;
  style?: "default" | "cancel" | "destructive";
};

type ThemedAlertProps = {
  visible: boolean;
  title: string;
  message: string;
  buttons?: ThemedAlertButton[];
  onDismiss?: () => void;
};

export const ThemedAlert: React.FC<ThemedAlertProps> = ({
  visible,
  title,
  message,
  buttons = [],
  onDismiss,
}) => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;

  const defaultButtons: ThemedAlertButton[] =
    buttons.length > 0
      ? buttons
      : [{ text: "OK", onPress: onDismiss || (() => {}), style: "default" }];

  console.log(
    `📋 [ThemedAlert] Rendering ${defaultButtons.length} buttons:`,
    defaultButtons.map((b) => b.text),
  );

  const handleButtonPress = (button: ThemedAlertButton) => {
    console.log(`🔘 [ThemedAlert] Button pressed: "${button.text}"`);
    try {
      // Execute the button's onPress callback
      const result = button.onPress() as any;

      // If it's a Promise (async function), handle it asynchronously
      if (result && typeof result.catch === "function") {
        result.catch((error: any) => {
          console.error(
            `❌ [ThemedAlert] Error in async onPress for "${button.text}":`,
            error,
          );
        });
      }

      console.log(`✅ [ThemedAlert] onPress executed for "${button.text}"`);
    } catch (error) {
      console.error(
        `❌ [ThemedAlert] Error in onPress for "${button.text}":`,
        error,
      );
    }

    // NOTE: No automatic dismiss - buttons must call onDismiss/dismissAlert manually if needed
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.alertContainer,
            { backgroundColor: colors.surfaceElevated },
          ]}
        >
          <LinearGradient
            colors={[
              withAlpha(colors.accent, 0.08),
              withAlpha(colors.accent, 0.02),
            ]}
            style={styles.header}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: withAlpha(colors.accent, 0.15) },
              ]}
            >
              <Feather name="info" size={24} color={colors.accent} />
            </View>
          </LinearGradient>

          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {title}
            </Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {message}
            </Text>
          </View>

          <View
            style={[
              styles.buttonContainer,
              { borderTopColor: withAlpha(colors.textPrimary, 0.1) },
            ]}
          >
            {defaultButtons.map((button, index) => {
              const isDestructive = button.style === "destructive";
              const isCancel = button.style === "cancel";
              const buttonColor = isDestructive
                ? colors.danger
                : isCancel
                  ? colors.textSecondary
                  : colors.accent;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    index < defaultButtons.length - 1 && {
                      borderRightWidth: 1,
                      borderRightColor: withAlpha(colors.textPrimary, 0.1),
                    },
                  ]}
                  onPress={() => handleButtonPress(button)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buttonText, { color: buttonColor }]}>
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertContainer: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "center",
  },
});
