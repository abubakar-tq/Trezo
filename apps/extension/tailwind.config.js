/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#060608",
        surface: "rgba(14,12,18,.95)",
        card: "rgba(20,16,27,.72)",
        "card-2": "rgba(26,21,35,.6)",
        elevated: "rgba(24,20,32,.95)",
        "muted-surface": "rgba(14,12,18,.45)",
        border: "rgba(124,58,237,.13)",
        "border-2": "rgba(124,58,237,.07)",
        text: "#F4F1EA",
        text2: "#9A968F",
        text3: "#5C5A55",
        accent: "#7C3AED",
        "accent-soft": "rgba(124,58,237,.15)",
        accent2: "#06B6D4",
        success: "#34D399",
        "success-soft": "rgba(52,211,153,.13)",
        warning: "#F59E0B",
        "warning-soft": "rgba(245,158,11,.13)",
        danger: "#E8654F",
        "danger-soft": "rgba(232,101,79,.13)",
        glassBorder: "rgba(124,58,237,.1)",
        "input-bg": "rgba(12,10,16,.85)",
        "input-border": "rgba(124,58,237,.16)",
      },
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "16px",
        btn: "13px",
        chip: "999px",
        icon: "10px",
        hero: "18px",
      },
      boxShadow: {
        pop: "0 28px 80px rgba(6,2,16,.75),0 0 0 1px rgba(124,58,237,.08)",
        accent: "0 8px 22px rgba(124,58,237,.34)",
      },
    },
  },
  plugins: [],
};
