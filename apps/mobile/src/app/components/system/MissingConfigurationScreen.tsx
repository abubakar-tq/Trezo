import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

interface MissingConfigurationScreenProps {
  message: string;
  onRetry?: () => void;
}

export const MissingConfigurationScreen: React.FC<MissingConfigurationScreenProps> = ({
  message,
  onRetry,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuration required</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.instructions}>
        Add <Text style={styles.highlight}>EXPO_PUBLIC_SUPABASE_URL</Text> and
        <Text style={styles.highlight}> EXPO_PUBLIC_SUPABASE_ANON_KEY</Text> values to your
        <Text style={styles.highlight}> .env</Text> file, then restart Expo. If you are using Expo Go,
        stop the server and run it again so the new values load into the bundle.
      </Text>
      {onRetry ? (
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonLabel}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  message: {
    color: colors.textPrimary,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  instructions: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  highlight: {
    color: colors.accent,
    fontWeight: "600",
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonLabel: {
    color: colors.textOnAccent,
    fontWeight: "600",
    fontSize: 16,
  },
});
