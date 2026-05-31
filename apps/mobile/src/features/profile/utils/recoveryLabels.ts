export function delayLabel(seconds: number): string {
  const map: Record<number, string> = {
    86400: "24 hours",
    172800: "48 hours",
    604800: "7 days",
  };
  const h = Math.round(seconds / 3600);
  return map[seconds] ?? `${h} ${h === 1 ? "hour" : "hours"}`;
}

export const DELAY_CHOICES = [
  { seconds: 86400, label: "24 hours", note: "" },
  { seconds: 172800, label: "48 hours", note: "Recommended" },
  { seconds: 604800, label: "7 days", note: "Most cautious" },
] as const;

export function approvalsSummary(threshold: number, total: number): string {
  return `${threshold} of ${total} approvals`;
}
