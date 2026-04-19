/**
 * BaseModal - Reusable modal component with consistent styling
 * Provides a standardized modal interface for the app
 */

import { Feather } from "@expo/vector-icons";
import React from "react";
import {
    Modal,
    ModalProps,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

export interface BaseModalProps extends Omit<ModalProps, "children"> {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  maxHeight?: number;
  contentContainerStyle?: any;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  visible,
  onDismiss,
  title,
  children,
  showCloseButton = true,
  maxHeight,
  contentContainerStyle,
  ...modalProps
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = createStyles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
      {...modalProps}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable
          style={[styles.content, maxHeight ? { maxHeight } : undefined]}
          onPress={(e) => e.stopPropagation()}
        >
          {(title || showCloseButton) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              {showCloseButton && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={onDismiss}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="x" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: withAlpha(colors.background, 0.92),
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    content: {
      width: "100%",
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.border, 0.1),
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
      flex: 1,
    },
    closeButton: {
      marginLeft: 12,
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: withAlpha(colors.border, 0.1),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
  });
