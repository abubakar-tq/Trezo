/**
 * Converts a hex or rgba color to RGBA with a specified alpha channel.
 * Marked as a worklet to ensure compatibility with Reanimated 4.
 */
export function withAlpha(color: string, alpha: number): string {
  if (!color) return `rgba(0,0,0,${alpha})`;

  // If it's already rgba, we replace the alpha component
  if (color.startsWith("rgba")) {
    const parts = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*(?:\.\d+)?))?\)/);
    if (parts) {
      const r = parts[1];
      const g = parts[2];
      const b = parts[3];
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }

  // Handle Hex
  const hex = color.startsWith("#") ? color : `#${color}`;
  const normalized = hex.length === 4
    ? hex.replace("#", "").split("").map((char) => char + char).join("")
    : hex.replace("#", "");

  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
