import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
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
const SAT_COUNT = 6;

type Props = { width: number; height: number };

const MultiChainScene: React.FC<Props> = ({ width: W, height: H }) => {
  const CX = W / 2;
  const CY = H * 0.48;
  const S = W / 320;
  const SAT_R = 100 * S;

  const satellitePositions = Array.from({ length: SAT_COUNT }, (_, i) => {
    const a = (i / SAT_COUNT) * TAU - Math.PI / 2;
    return { x: CX + Math.cos(a) * SAT_R, y: CY + Math.sin(a) * SAT_R };
  });

  const linesPath = (() => {
    const p = Skia.Path.Make();
    satellitePositions.forEach((pos) => {
      p.moveTo(CX, CY);
      p.lineTo(pos.x, pos.y);
    });
    for (let i = 0; i < SAT_COUNT; i++) {
      const a = satellitePositions[i];
      const b = satellitePositions[(i + 1) % SAT_COUNT];
      p.moveTo(a.x, a.y);
      p.lineTo(b.x, b.y);
    }
    return p;
  })();

  const arcA = (() => {
    const p = Skia.Path.Make();
    const r = 132 * S;
    p.addArc(Skia.XYWHRect(CX - r, CY - r, r * 2, r * 2), -10, 80);
    return p;
  })();
  const arcB = (() => {
    const p = Skia.Path.Make();
    const r = 132 * S;
    p.addArc(Skia.XYWHRect(CX - r, CY - r, r * 2, r * 2), 170, 80);
    return p;
  })();

  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 16000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [t]);

  const orbitT = useDerivedValue(() => [{ rotate: t.value * TAU }]);
  const counterT = useDerivedValue(() => [{ rotate: -t.value * TAU * 0.6 }]);
  const corePulseR = useDerivedValue(() => (30 + Math.sin(t.value * TAU * 2) * 5) * S);
  const satR = useDerivedValue(() => (8 + Math.sin(t.value * TAU * 2) * 1.5) * S);
  const satGlow = useDerivedValue(() => 0.55 + Math.sin(t.value * TAU * 2) * 0.2);

  return (
    <View style={{ width: W, height: H }}>
      <Canvas style={{ flex: 1 }}>
        {/* Counter-rotating outer arcs */}
        <Group transform={counterT} origin={vec(CX, CY)}>
          <Path path={arcA} style="stroke" strokeWidth={2 * S} color="#22D3EE" strokeCap="round" opacity={0.7} />
          <Path path={arcB} style="stroke" strokeWidth={2 * S} color="#67E8F9" strokeCap="round" opacity={0.55} />
        </Group>

        {/* Rotating constellation */}
        <Group transform={orbitT} origin={vec(CX, CY)}>
          <Path path={linesPath} style="stroke" strokeWidth={1 * S} color="rgba(103,232,249,0.45)" />
          {satellitePositions.map((pos, i) => (
            <Group key={`s${i}`}>
              <Circle cx={pos.x} cy={pos.y} r={17 * S} color="rgba(34,211,238,0.5)" opacity={satGlow}>
                <BlurMask blur={12 * S} style="normal" />
              </Circle>
              <Circle cx={pos.x} cy={pos.y} r={satR}>
                <RadialGradient
                  c={vec(pos.x, pos.y)}
                  r={10 * S}
                  colors={["#FFFFFF", "#67E8F9", "#06B6D4"]}
                />
              </Circle>
              <Circle cx={pos.x} cy={pos.y} r={3 * S} color="#FFFFFF" />
            </Group>
          ))}
        </Group>

        {/* Center node */}
        <Circle cx={CX} cy={CY} r={52 * S} color="rgba(34,211,238,0.5)">
          <BlurMask blur={28 * S} style="normal" />
        </Circle>
        <Circle cx={CX} cy={CY} r={corePulseR}>
          <RadialGradient
            c={vec(CX, CY)}
            r={34 * S}
            colors={["#FFFFFF", "#A5F3FC", "#06B6D4"]}
          />
        </Circle>
        <Circle cx={CX} cy={CY} r={18 * S} color="#FFFFFF" opacity={0.95} />
      </Canvas>
    </View>
  );
};

export default MultiChainScene;
