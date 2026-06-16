interface LogoProps {
  size?: number;
  className?: string;
}

/** Renders the real Trezo logo via chrome.runtime.getURL. */
export function Logo({ size = 32, className }: LogoProps) {
  const src = chrome.runtime.getURL("icons/icon128.png");
  return (
    <img
      src={src}
      alt="Trezo"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: Math.round(size * 0.29), boxShadow: "0 4px 12px rgba(124,58,237,.4)" }}
    />
  );
}
