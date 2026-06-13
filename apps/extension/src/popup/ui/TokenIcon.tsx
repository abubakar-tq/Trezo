import { useEffect, useState } from "react";

interface TokenIconProps {
  symbol: string;
  /** Real logo URL (e.g. CoinGecko `image`). When absent, a gradient letter is
   *  rendered with NO network request — so unknown tokens never 404 the console. */
  src?: string;
  gradient?: string;
  color?: string;
  size?: number;
  className?: string;
}

const DEFAULT_GRADIENTS: Record<string, string> = {
  ETH:   "linear-gradient(135deg,#627EEA,#3C5BD6)",
  WETH:  "linear-gradient(135deg,#627EEA,#3C5BD6)",
  USDC:  "linear-gradient(135deg,#2775CA,#1b5b9e)",
  USDT:  "linear-gradient(135deg,#26A17B,#1a7355)",
  DAI:   "linear-gradient(135deg,#F5AC37,#b8791d)",
  BTC:   "linear-gradient(135deg,#F7931A,#c9740f)",
  SOL:   "linear-gradient(135deg,#9945FF,#6a1fc2)",
  LINK:  "linear-gradient(135deg,#2A5ADA,#1e3fa8)",
  MATIC: "linear-gradient(135deg,#8247E5,#5c2db0)",
  AVAX:  "linear-gradient(135deg,#E84142,#a82020)",
  BNB:   "linear-gradient(135deg,#F3BA2F,#b8851a)",
  UNI:   "linear-gradient(135deg,#FF007A,#b8004e)",
};

/**
 * Circular token badge.
 * Renders the provided logo image when `src` is set; on load error (or when no
 * `src` is given) falls back to a branded gradient circle with the first letter.
 * No image request is made unless a real URL is supplied — avoids console 404s.
 */
export function TokenIcon({ symbol, src, gradient, color, size = 34, className = "" }: TokenIconProps) {
  const [imgFailed, setImgFailed] = useState(false);
  // Reset the failure flag if the URL changes (component reused across list rows)
  useEffect(() => { setImgFailed(false); }, [src]);

  const upper = symbol.toUpperCase();
  const bg =
    gradient ??
    color ??
    DEFAULT_GRADIENTS[upper] ??
    "linear-gradient(135deg,rgba(124,58,237,.35),rgba(124,58,237,.65))";

  const showImg = !!src && !imgFailed;
  const imgSize = Math.round(size * 0.86); // logos already have their own padding

  return (
    <div
      className={`grid place-items-center flex-none overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: showImg ? "transparent" : bg,
        flexShrink: 0,
      }}
    >
      {showImg ? (
        <img
          src={src}
          alt={symbol}
          width={imgSize}
          height={imgSize}
          style={{ display: "block", objectFit: "contain", borderRadius: "50%" }}
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      ) : (
        <span
          className="font-bold text-white select-none"
          style={{ fontSize: Math.round(size * 0.38) }}
        >
          {upper.slice(0, 1)}
        </span>
      )}
    </div>
  );
}
