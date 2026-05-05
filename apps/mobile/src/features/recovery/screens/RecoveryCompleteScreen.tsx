import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { RootStackParamList } from "@/src/types/navigation";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";

type Route = RouteProp<RootStackParamList, "RecoveryComplete">;

const RecoveryCompleteScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Complete</Text>
        <Text style={styles.title}>Recovery finished.</Text>
        <Text style={styles.body}>Request {route.params.requestId}</Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("TabNavigation")}
        >
          <Text style={styles.primaryButtonText}>Return to wallet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: 24,
      backgroundColor: colors.background,
      justifyContent: "center",
    },
    card: {
      borderRadius: 28,
      padding: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
    },
    kicker: {
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 2,
      fontSize: 12,
      fontWeight: "700",
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "800",
      lineHeight: 32,
    },
    body: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    primaryButton: {
      paddingVertical: 16,
      borderRadius: 18,
      backgroundColor: colors.accent,
      alignItems: "center",
    },
    primaryButtonText: {
      color: colors.textOnAccent,
      fontWeight: "700",
      fontSize: 16,
    },
  });

export default RecoveryCompleteScreen;
