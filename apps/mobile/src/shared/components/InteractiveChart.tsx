import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';

interface InteractiveChartProps {
  data: number[];
  chartWidth: number;
  chartHeight: number;
  color: string;
  /** Called when user touches/releases. null on release. */
  onTouchValue?: (value: number | null) => void;
  /** Custom formatter for the inline price tooltip. */
  formatTooltip?: (value: number) => string;
}

export const InteractiveChart = React.memo<InteractiveChartProps>(({
  data,
  chartWidth,
  chartHeight,
  color,
  onTouchValue,
  formatTooltip,
}) => {
  const [touch, setTouch] = React.useState<{ x: number; y: number; price: number } | null>(null);
  const LABEL_H = 28;
  const drawH = chartHeight - LABEL_H;

  const { points, pathD, fillD } = React.useMemo(() => {
    const empty = { points: [] as { x: number; y: number; price: number }[], pathD: '', fillD: '' };
    if (!data || data.length < 2) return empty;
    const vals = data.map(Number).filter(isFinite);
    if (vals.length < 2) return empty;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const pts = vals.map((val, i) => ({
      x: (i / (vals.length - 1)) * chartWidth,
      y: LABEL_H + drawH - ((val - min) / range) * drawH * 0.88 - drawH * 0.06,
      price: val,
    }));
    const pd = pts.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
    const fd = `${pd} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;
    return { points: pts, pathD: pd, fillD: fd };
  }, [data, chartWidth, chartHeight, drawH]);

  const nearest = (touchX: number) => {
    if (!points.length) return null;
    const idx = Math.round(Math.max(0, Math.min(touchX / chartWidth, 1)) * (points.length - 1));
    return points[Math.max(0, Math.min(idx, points.length - 1))];
  };

  const handleTouchStart = (e: any) => {
    const p = nearest(e.nativeEvent.locationX);
    if (p) { setTouch(p); onTouchValue?.(p.price); }
  };
  const handleTouchMove = (e: any) => {
    const p = nearest(e.nativeEvent.locationX);
    if (p) { setTouch(p); onTouchValue?.(p.price); }
  };
  const handleTouchEnd = () => {
    setTouch(null);
    onTouchValue?.(null);
  };

  const defaultFormat = (v: number) =>
    v >= 1
      ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${v.toFixed(6)}`;

  const fmt = formatTooltip ?? defaultFormat;

  return (
    <View
      style={{ width: chartWidth, height: chartHeight }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="icGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {fillD ? <Path d={fillD} fill="url(#icGrad)" /> : null}
        {pathD ? (
          <Path d={pathD} stroke={color} strokeWidth={2.5} fill="transparent" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {touch ? (
          <>
            <Line
              x1={touch.x} y1={LABEL_H}
              x2={touch.x} y2={chartHeight}
              stroke={color} strokeWidth={1}
              strokeDasharray="4 3" opacity={0.6}
            />
            <Circle cx={touch.x} cy={touch.y} r={7} fill={color} opacity={0.2} />
            <Circle cx={touch.x} cy={touch.y} r={4} fill={color} />
            <Circle cx={touch.x} cy={touch.y} r={2} fill="white" />
          </>
        ) : null}
      </Svg>
      {touch ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 4,
            left: Math.min(Math.max(touch.x - 36, 0), chartWidth - 100),
          }}
        >
          <Text style={{ color, fontSize: 12, fontWeight: '800' }}>
            {fmt(touch.price)}
          </Text>
        </View>
      ) : null}
    </View>
  );
});
