import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface MissingConfigurationScreenProps {
  message: string;
  onRetry?: () => void;
}

export const MissingConfigurationScreen: React.FC<MissingConfigurationScreenProps> = ({
  message,
  onRetry,
}) => {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "#000000",
  },
  title: {
    color: "#f9fafb",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  message: {
    color: "#f3f4f6",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  instructions: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  highlight: {
    color: "#60a5fa",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#60a5fa",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonLabel: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 16,
  },
});
