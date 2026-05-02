import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import { withAlpha } from "@utils/color";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

interface EmptyStateProps {
  icon: FeatherIconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = createStyles(colors);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Feather name={icon} size={48} color={colors.accentAlt} />
        <View style={styles.iconPulse} />
      </View>
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      
      {actionLabel && onAction && (
        <TouchableOpacity 
          style={styles.button} 
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
          <Feather name="arrow-right" size={18} color="#FFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      justifyContent: "center",
      padding: 30,
      backgroundColor: withAlpha(colors.surfaceCard, 0.5),
      borderRadius: 24,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.5),
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: withAlpha(colors.accentAlt, 0.1),
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
      position: "relative",
    },
    iconPulse: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.2),
      opacity: 0.5,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 10,
    },
    description: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 22,
      textAlign: "center",
      marginBottom: 30,
    },
    button: {
      backgroundColor: colors.accentAlt,
      height: 60,
      borderRadius: 20,
      paddingHorizontal: 24,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    },
    buttonText: {
      color: "#FFF",
      fontSize: 17,
      fontWeight: "700",
    },
  });
