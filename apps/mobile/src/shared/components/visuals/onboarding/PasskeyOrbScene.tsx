import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
  SweepGradient,
  vec,
} from "@shopify/react-native-skia";
import React, { useEffect } from "react";
import { View } from "react-native";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const TAU = Math.PI * 2;

type Props = { width: number; height: number };

const PasskeyOrbScene: React.FC<Props> = ({ width: W, height: H }) => {
  const CX = W / 2;
  const CY = H * 0.48;
  const S = W / 320; // scale factor

  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [t]);

  const r1 = 118 * S;
  const r2 = 88 * S;
  const r3 = 60 * S;

  const ring1Path = Skia.Path.Make();
  ring1Path.addArc(Skia.XYWHRect(CX - r1, CY - r1, r1 * 2, r1 * 2), 20, 230);
  const ring2Path = Skia.Path.Make();
  ring2Path.addArc(Skia.XYWHRect(CX - r2, CY - r2, r2 * 2, r2 * 2), -160, 200);
  const ring3Path = Skia.Path.Make();
  ring3Path.addArc(Skia.XYWHRect(CX - r3, CY - r3, r3 * 2, r3 * 2), 70, 250);

  const ring1T = useDerivedValue(() => [{ rotate: t.value * TAU }]);
  const ring2T = useDerivedValue(() => [{ rotate: -t.value * TAU * 0.7 }]);
  const ring3T = useDerivedValue(() => [{ rotate: t.value * TAU * 1.35 }]);
  const pulseR = useDerivedValue(() => (22 + Math.sin(t.value * TAU * 2) * 3) * S);

  const o1x = useDerivedValue(() => CX + Math.cos(t.value * TAU) * r1);
  const o1y = useDerivedValue(() => CY + Math.sin(t.value * TAU) * r1);
  const o2x = useDerivedValue(() => CX + Math.cos(-t.value * TAU * 0.7 + Math.PI) * r2);
  const o2y = useDerivedValue(() => CY + Math.sin(-t.value * TAU * 0.7 + Math.PI) * r2);
  const o3x = useDerivedValue(() => CX + Math.cos(t.value * TAU * 1.35 + 1.2) * r3);
  const o3y = useDerivedValue(() => CY + Math.sin(t.value * TAU * 1.35 + 1.2) * r3);

  return (
    <View style={{ width: W, height: H }}>
      <Canvas style={{ flex: 1 }}>
        {/* Core radial burst */}
        <Circle cx={CX} cy={CY} r={50 * S}>
          <RadialGradient
            c={vec(CX, CY)}
            r={50 * S}
            colors={["#FFFFFF", "#DDD6FE", "#A78BFA", "rgba(139,92,246,0)"]}
          />
        </Circle>
        <Circle cx={CX} cy={CY} r={pulseR} color="#FFFFFF">
          <BlurMask blur={4} style="solid" />
        </Circle>

        {/* Rotating rings */}
        <Group transform={ring1T} origin={vec(CX, CY)}>
          <Path path={ring1Path} style="stroke" strokeWidth={2 * S} strokeCap="round">
            <SweepGradient
              c={vec(CX, CY)}
              colors={["rgba(196,181,253,0)", "#C4B5FD", "#8B5CF6", "rgba(139,92,246,0)"]}
            />
          </Path>
        </Group>
        <Group transform={ring2T} origin={vec(CX, CY)}>
          <Path path={ring2Path} color="#A78BFA" style="stroke" strokeWidth={1.5 * S} strokeCap="round" opacity={0.7} />
        </Group>
        <Group transform={ring3T} origin={vec(CX, CY)}>
          <Path path={ring3Path} color="#DDD6FE" style="stroke" strokeWidth={1 * S} strokeCap="round" opacity={0.55} />
        </Group>

        {/* Orbiting particles */}
        <Circle cx={o1x} cy={o1y} r={5 * S} color="#FFFFFF">
          <BlurMask blur={5 * S} style="solid" />
        </Circle>
        <Circle cx={o2x} cy={o2y} r={3.5 * S} color="#C4B5FD">
          <BlurMask blur={3 * S} style="solid" />
        </Circle>
        <Circle cx={o3x} cy={o3y} r={2.5 * S} color="#FFFFFF">
          <BlurMask blur={2 * S} style="solid" />
        </Circle>

        {/* Scattered accent sparkles */}
        <Circle cx={CX - 64 * S} cy={CY - 92 * S} r={2.2 * S} color="#A78BFA" opacity={0.65}>
          <BlurMask blur={2 * S} style="solid" />
        </Circle>
        <Circle cx={CX + 95 * S} cy={CY + 74 * S} r={2.5 * S} color="#DDD6FE" opacity={0.5}>
          <BlurMask blur={2 * S} style="solid" />
        </Circle>
        <Circle cx={CX - 108 * S} cy={CY + 60 * S} r={1.6 * S} color="#C4B5FD" opacity={0.4}>
          <BlurMask blur={1.5 * S} style="solid" />
        </Circle>
        <Circle cx={CX + 40 * S} cy={CY - 130 * S} r={1.8 * S} color="#A78BFA" opacity={0.45}>
          <BlurMask blur={1.5 * S} style="solid" />
        </Circle>
      </Canvas>
    </View>
  );
};

export default PasskeyOrbScene;
