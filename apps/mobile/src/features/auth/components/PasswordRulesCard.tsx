import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

type RequirementState = "met" | "pending" | "unmet";

type PasswordRulesCardProps = {
  password: string;
  confirmPassword: string;
  style?: StyleProp<ViewStyle>;
};

type Requirement = {
  key: string;
  label: string;
  state: RequirementState;
};

const MIN_LENGTH = 8;

const getState = (met: boolean, hasInput: boolean): RequirementState => {
  if (met) return "met";
  return hasInput ? "unmet" : "pending";
};

const PasswordRulesCard: React.FC<PasswordRulesCardProps> = ({ password, confirmPassword, style }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const colorByState = {
    met: colors.success,
    pending: colors.warning,
    unmet: colors.danger,
  };
  const sanitizedPassword = password ?? "";
  const sanitizedConfirm = confirmPassword ?? "";

  const requirements = useMemo<Requirement[]>(() => {
    const hasPasswordInput = sanitizedPassword.length > 0;
    const hasConfirmInput = sanitizedConfirm.length > 0;

    const lengthState = getState(sanitizedPassword.length >= MIN_LENGTH, hasPasswordInput);
    const hasUppercase = /[A-Z]/.test(sanitizedPassword);
    const hasLowercase = /[a-z]/.test(sanitizedPassword);
    const hasNumber = /[0-9]/.test(sanitizedPassword);
    const compositionState = getState(hasUppercase && hasLowercase && hasNumber, hasPasswordInput);

    const compositionLabel = (() => {
      if (!hasPasswordInput || compositionState === "met") {
        return "Use at least one uppercase letter, one lowercase letter, and one number.";
      }
      const missing: string[] = [];
      if (!hasUppercase) missing.push("uppercase");
      if (!hasLowercase) missing.push("lowercase");
      if (!hasNumber) missing.push("number");
      if (missing.length === 1) {
        return `Add a ${missing[0]} character.`;
      }
      if (missing.length === 2) {
        return `Add ${missing[0]} and ${missing[1]} characters.`;
      }
      return "Add uppercase, lowercase, and numeric characters.";
    })();

    const matchMet = sanitizedPassword.length > 0 && sanitizedPassword === sanitizedConfirm;
    const matchState: RequirementState = (() => {
      if (matchMet) return "met";
      if (!hasConfirmInput) return "pending";
      return "unmet";
    })();

    return [
      { key: "length", label: `At least ${MIN_LENGTH} characters`, state: lengthState },
      { key: "composition", label: compositionLabel, state: compositionState },
      { key: "match", label: "Both password fields must match exactly.", state: matchState },
    ];
  }, [sanitizedConfirm, sanitizedPassword]);

  return (
    <LinearGradient
      colors={[`${colors.accent}59`, `${colors.accent}33`] as const}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, style]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleIcon}>
          <Feather name="shield" size={14} color={`${colors.textPrimary}CC`} />
        </View>
        <Text style={styles.title}>Password requirements</Text>
      </View>
      <Text style={styles.subtitle}>Meet every item below to keep your account secure.</Text>
      <View style={styles.rulesWrapper}>
        {requirements.map(({ key, label, state }) => {
          const color = colorByState[state];
          const iconName = state === "met" ? "check-circle" : state === "pending" ? "help-circle" : "x-circle";
          return (
            <View key={key} style={styles.ruleRow}>
              <Feather name={iconName} size={16} color={color} style={styles.ruleIcon} />
              <Text style={[styles.ruleText, state === "met" && styles.ruleTextMet]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
};

export default PasswordRulesCard;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: `${colors.accent}4D`,
    backgroundColor: `${colors.surface}E0`,
    rowGap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  titleIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.accent}40`,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: `${colors.textPrimary}CC`,
    fontSize: 12,
    opacity: 0.9,
  },
  rulesWrapper: {
    rowGap: 6,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ruleIcon: {
    marginRight: 10,
  },
  ruleText: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  ruleTextMet: {
    color: colors.success,
  },
});
