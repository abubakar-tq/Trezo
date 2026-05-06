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

type Props = { width: number; height: number };

const ShieldScene: React.FC<Props> = ({ width: W, height: H }) => {
  const CX = W / 2;
  const CY = H * 0.48;
  const S = W / 320;

  const hexPath = (radius: number, rotRad = 0) => {
    const p = Skia.Path.Make();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - Math.PI / 2 + rotRad;
      const x = CX + Math.cos(a) * radius;
      const y = CY + Math.sin(a) * radius;
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    p.close();
    return p;
  };

  const hexOuter = hexPath(115 * S);
  const hexMid = hexPath(88 * S);
  const hexInner = hexPath(62 * S);

  const checkPath = (() => {
    const p = Skia.Path.Make();
    p.moveTo(CX - 22 * S, CY + 2 * S);
    p.lineTo(CX - 6 * S, CY + 18 * S);
    p.lineTo(CX + 24 * S, CY - 16 * S);
    return p;
  })();

  const t = useSharedValue(0);
  const sp = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, false);
    sp.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [t, sp]);

  const outerT = useDerivedValue(() => [{ rotate: t.value * TAU * 0.5 }]);
  const midT = useDerivedValue(() => [{ rotate: -t.value * TAU * 0.7 }]);
  const innerT = useDerivedValue(() => [{ rotate: t.value * TAU }]);
  const coreR = useDerivedValue(() => (32 + Math.sin(t.value * TAU * 2) * 4) * S);

  const sp1 = useDerivedValue(() => 0.3 + Math.sin(sp.value * Math.PI) * 0.7);
  const sp2 = useDerivedValue(() => 0.3 + Math.sin((sp.value + 0.33) * Math.PI) * 0.7);
  const sp3 = useDerivedValue(() => 0.3 + Math.sin((sp.value + 0.66) * Math.PI) * 0.7);

  return (
    <View style={{ width: W, height: H }}>
      <Canvas style={{ flex: 1 }}>
        {/* Rotating hexagons */}
        <Group transform={outerT} origin={vec(CX, CY)}>
          <Path path={hexOuter} style="stroke" strokeWidth={2 * S} color="#34D399" strokeJoin="round" opacity={0.5} />
        </Group>
        <Group transform={midT} origin={vec(CX, CY)}>
          <Path path={hexMid} style="fill" color="rgba(16,185,129,0.1)" />
          <Path path={hexMid} style="stroke" strokeWidth={2.5 * S} color="#10B981" strokeJoin="round" opacity={0.9} />
        </Group>
        <Group transform={innerT} origin={vec(CX, CY)}>
          <Path path={hexInner} style="stroke" strokeWidth={1.5 * S} color="#6EE7B7" strokeJoin="round" opacity={0.7} />
        </Group>

        {/* Core glow + pulse */}
        <Circle cx={CX} cy={CY} r={coreR}>
          <RadialGradient
            c={vec(CX, CY)}
            r={36 * S}
            colors={["#FFFFFF", "#A7F3D0", "#10B981", "rgba(16,185,129,0)"]}
          />
        </Circle>

        {/* Checkmark */}
        <Path path={checkPath} style="stroke" strokeWidth={5 * S} strokeCap="round" strokeJoin="round" color="#FFFFFF">
          <BlurMask blur={2 * S} style="solid" />
        </Path>

        {/* Sparkles spread wide across the canvas */}
        <Circle cx={CX - 105 * S} cy={CY - 60 * S} r={3 * S} color="#A7F3D0" opacity={sp1}>
          <BlurMask blur={3 * S} style="solid" />
        </Circle>
        <Circle cx={CX + 112 * S} cy={CY - 80 * S} r={2.4 * S} color="#FFFFFF" opacity={sp2}>
          <BlurMask blur={2.5 * S} style="solid" />
        </Circle>
        <Circle cx={CX + 96 * S} cy={CY + 95 * S} r={3.2 * S} color="#6EE7B7" opacity={sp3}>
          <BlurMask blur={3 * S} style="solid" />
        </Circle>
        <Circle cx={CX - 118 * S} cy={CY + 68 * S} r={2 * S} color="#A7F3D0" opacity={sp2}>
          <BlurMask blur={2 * S} style="solid" />
        </Circle>
        <Circle cx={CX - 30 * S} cy={CY - 140 * S} r={1.8 * S} color="#FFFFFF" opacity={sp1}>
          <BlurMask blur={2 * S} style="solid" />
        </Circle>
        <Circle cx={CX + 58 * S} cy={CY + 138 * S} r={1.6 * S} color="#6EE7B7" opacity={sp3}>
          <BlurMask blur={1.5 * S} style="solid" />
        </Circle>
        <Circle cx={CX + 140 * S} cy={CY + 20 * S} r={1.4 * S} color="#34D399" opacity={sp2}>
          <BlurMask blur={1.5 * S} style="solid" />
        </Circle>
        <Circle cx={CX - 145 * S} cy={CY + 10 * S} r={1.4 * S} color="#34D399" opacity={sp1}>
          <BlurMask blur={1.5 * S} style="solid" />
        </Circle>
      </Canvas>
    </View>
  );
};

export default ShieldScene;
