/**
 * RecoveryScoreWidget Component
 * Displays the security gamification metric (0-100%)
 * Color-coded: gray (0-40%), amber (41-74%), teal (75-99%), emerald (100%)
 */

import React from "react";
import { View, ViewProps } from "react-native";
import { useAppTheme } from "@theme";
import { BodyText, CaptionText, DisplayText, HeadlineText } from "../Tier1/Text";

interface RecoveryScoreWidgetProps extends Omit<ViewProps, "style"> {
  score: number; // 0-100
  compact?: boolean;
}

const getScoreColor = (score: number, colors: any) => {
  if (score === 100) return colors.success;
  if (score >= 75) return colors.accent;
  if (score >= 41) return colors.warning;
  return colors.textMuted;
};

const getScoreLabel = (score: number) => {
  if (score === 100) return "Fully Protected";
  if (score >= 75) return "Almost Protected";
  if (score >= 41) return "Getting There";
  return "Not Set Up Yet";
};

export const RecoveryScoreWidget: React.FC<RecoveryScoreWidgetProps> = ({
  score,
  compact = false,
  ...props
}) => {
  const { theme: { colors } } = useAppTheme();
  const color = getScoreColor(score, colors);
  const label = getScoreLabel(score);

  if (compact) {
    return (
      <View style={{ gap: 8 }} {...props}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <CaptionText>Security Score</CaptionText>
          <HeadlineText color={color}>{score}%</HeadlineText>
        </View>
        <View
          style={{
            height: 8,
            backgroundColor: colors.surfaceMuted,
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
        <CaptionText color={color}>{label}</CaptionText>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: colors.surfaceCard,
        borderRadius: 16,
        padding: 24,
        gap: 16,
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
      {...props}
    >
      <HeadlineText>Recovery Score</HeadlineText>

      <View style={{ justifyContent: "center", alignItems: "center" }}>
        <DisplayText color={color}>{score}%</DisplayText>
        <BodyText color={color} style={{ marginTop: 4 }}>
          {label}
        </BodyText>
      </View>

      <View
        style={{
          height: 12,
          backgroundColor: colors.surface,
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

      <View style={{ gap: 6, marginTop: 8 }}>
        <BreakdownRow label="Passkey" points={20} active={score >= 20} />
        <BreakdownRow label="Email Recovery" points={25} active={score >= 45} />
        <BreakdownRow label="Phone Recovery" points={20} active={score >= 65} />
        <BreakdownRow label="Active Guardians" points={25} active={score >= 90} />
        <BreakdownRow label="Threshold Configured" points={10} active={score >= 100} />
      </View>
    </View>
  );
};

interface BreakdownRowProps {
  label: string;
  points: number;
  active: boolean;
}

const BreakdownRow: React.FC<BreakdownRowProps> = ({ label, points, active }) => {
  const { theme: { colors } } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        opacity: active ? 1 : 0.4,
      }}
    >
      <CaptionText>{label}</CaptionText>
      <CaptionText color={active ? colors.success : colors.textMuted}>
        +{points}%
      </CaptionText>
    </View>
  );
};
