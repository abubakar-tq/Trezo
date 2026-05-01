/**
 * Converts a hex color to RGBA with a specified alpha channel.
 * Marked as a worklet to ensure compatibility with Reanimated 4.
 */
export function withAlpha(hex: string, alpha: number): string {
  
  if (!hex) return `rgba(0,0,0,${alpha})`;
  
  const normalized = hex.length === 4
    ? hex.replace("#", "").split("").map((char) => char + char).join("")
    : hex.replace("#", "");

  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
