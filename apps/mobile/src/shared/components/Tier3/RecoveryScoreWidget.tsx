/**
 * RecoveryScoreWidget Component
 * Displays the security gamification metric (0-100%)
 * Color-coded: gray (0-40%), amber (41-74%), teal (75-99%), emerald (100%)
 */

import React from "react";
import { View, ViewProps } from "react-native";
import { BodyText, CaptionText, DisplayText, HeadlineText } from "../Tier1/Text";
import { Colors } from "../TokenRegistry";

interface RecoveryScoreWidgetProps extends Omit<ViewProps, "style"> {
  score: number; // 0-100
  isDark?: boolean;
  compact?: boolean;
}

const getScoreColor = (score: number) => {
  if (score === 100) return Colors.success; // Emerald
  if (score >= 75) return "#06b6d4"; // Teal/Cyan
  if (score >= 41) return Colors.warning; // Amber
  return "#6b7280"; // Gray (neutral)
};

const getScoreLabel = (score: number) => {
  if (score === 100) return "Fully Protected";
  if (score >= 75) return "Almost Protected";
  if (score >= 41) return "Getting There";
  return "Not Set Up Yet";
};

export const RecoveryScoreWidget: React.FC<RecoveryScoreWidgetProps> = ({
  score,
  isDark = true,
  compact = false,
  ...props
}) => {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  if (compact) {
    return (
      <View
        style={{
          gap: 8,
        }}
        {...props}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <CaptionText isDark={isDark}>Security Score</CaptionText>
          <HeadlineText isDark={isDark} color={color}>
            {score}%
          </HeadlineText>
        </View>
        {/* Progress Bar */}
        <View
          style={{
            height: 8,
            backgroundColor: isDark ? Colors.surface : Colors.lightCard,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: "100%",
              width: `${score}%`,
              backgroundColor: color,
            }}
          />
        </View>
        <CaptionText isDark={isDark} color={color}>
          {label}
        </CaptionText>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: isDark ? Colors.card : Colors.lightCard,
        borderRadius: 16,
        padding: 24,
        gap: 16,
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
      {...props}
    >
      {/* Title */}
      <HeadlineText isDark={isDark}>Recovery Score</HeadlineText>

      {/* Large Score */}
      <View style={{ justifyContent: "center", alignItems: "center" }}>
        <DisplayText color={color}>{score}%</DisplayText>
        <BodyText isDark={isDark} color={color} style={{ marginTop: 4 }}>
          {label}
        </BodyText>
      </View>

      {/* Progress Bar */}
      <View
        style={{
          height: 12,
          backgroundColor: isDark ? Colors.surface : Colors.lightSurface,
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${score}%`,
            backgroundColor: color,
          }}
        />
      </View>

      {/* Breakdown */}
      <View style={{ gap: 6, marginTop: 8 }}>
        <BreakdownRow
          isDark={isDark}
          label="Passkey"
          points={20}
          active={score >= 20}
        />
        <BreakdownRow
          isDark={isDark}
          label="Email Recovery"
          points={25}
          active={score >= 45}
        />
        <BreakdownRow
          isDark={isDark}
          label="Phone Recovery"
          points={20}
          active={score >= 65}
        />
        <BreakdownRow
          isDark={isDark}
          label="Active Guardians"
          points={25}
          active={score >= 90}
        />
        <BreakdownRow
          isDark={isDark}
          label="Threshold Configured"
          points={10}
          active={score >= 100}
        />
      </View>
    </View>
  );
};

interface BreakdownRowProps {
  isDark: boolean;
  label: string;
  points: number;
  active: boolean;
}

const BreakdownRow: React.FC<BreakdownRowProps> = ({
  isDark,
  label,
  points,
  active,
}) => (
  <View
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      opacity: active ? 1 : 0.4,
    }}
  >
    <CaptionText isDark={isDark}>{label}</CaptionText>
    <CaptionText
      isDark={isDark}
      color={active ? Colors.success : Colors.textTertiary}
    >
      +{points}%
    </CaptionText>
  </View>
);
