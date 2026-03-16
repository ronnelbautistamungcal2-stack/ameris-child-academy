/**
 * SVG Logo for Ameris Academy – inspired by the original logo.
 * Features ABC blocks, child silhouettes, and the tagline.
 *
 * Props:
 *   size      – "sm" | "md" | "lg" | "xl"  (default "md")
 *   showText  – show "Ameris Academy" text  (default true)
 *   showTagline – show tagline              (default false)
 *   className – optional CSS class
 *   style     – optional inline styles
 */
export default function AmerisLogo({
  size = "md",
  showText = true,
  showTagline = false,
  className = "",
  style = {},
}) {
  const dims = SIZES[size] || SIZES.md;

  if (!showText) {
    // Icon-only version (blocks + child)
    return (
      <svg
        viewBox="0 0 80 80"
        width={dims.icon}
        height={dims.icon}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={style}
        aria-label="Ameris Academy"
      >
        {/* Compact blocks + child for icon mode */}
        <g transform="translate(10, 4) scale(0.9)">
          <Block x={22} y={2} color="#dc2626" letter="A" />
          <Block x={4} y={22} color="#f59e0b" letter="B" />
          <Block x={28} y={22} color="#2563eb" letter="C" />
          <Block x={0} y={42} color="#dc2626" letter="1" />
          <Block x={22} y={42} color="#16a34a" letter="2" />
          <Block x={44} y={42} color="#f59e0b" letter="3" />
          <g transform="translate(-4, 4)">
            <ChildPushing />
          </g>
        </g>
      </svg>
    );
  }

  const h = showTagline ? dims.fullH + 16 : dims.fullH;

  return (
    <svg
      viewBox={`0 0 ${dims.fullW} ${h}`}
      width={dims.fullW}
      height={h}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Ameris Academy – From Blessings to Pillars"
    >
      {/* Swoosh arc */}
      <path
        d={`M${dims.fullW * 0.18} ${dims.fullH * 0.12} Q${dims.fullW * 0.5} ${dims.fullH * -0.08} ${dims.fullW * 0.82} ${dims.fullH * 0.18}`}
        stroke="#b0bec5"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />

      {/* Left child with blocks */}
      <g transform={`translate(${dims.fullW * 0.02}, ${dims.fullH * 0.2}) scale(${dims.blockScale})`}>
        {/* Blocks */}
        {/* Row 1 – top */}
        <Block x={22} y={2} color="#dc2626" letter="A" />
        {/* Row 2 */}
        <Block x={4} y={22} color="#f59e0b" letter="B" />
        <Block x={28} y={22} color="#2563eb" letter="C" />
        {/* Row 3 – bottom */}
        <Block x={0} y={42} color="#dc2626" letter="1" />
        <Block x={22} y={42} color="#16a34a" letter="2" />
        <Block x={44} y={42} color="#f59e0b" letter="3" />

        {/* Child pushing blocks */}
        <g transform="translate(-4, 4)">
          <ChildPushing />
        </g>
      </g>

      {/* "Ameris Academy" text */}
      <text
        x={dims.fullW * 0.5}
        y={dims.fullH * 0.46}
        textAnchor="middle"
        fontFamily="'Nunito', sans-serif"
        fontWeight="900"
        fontSize={dims.titleSize}
        fill="#1e3a5f"
        letterSpacing="-0.02em"
      >
        Ameris
      </text>
      <text
        x={dims.fullW * 0.5}
        y={dims.fullH * 0.74}
        textAnchor="middle"
        fontFamily="'Nunito', sans-serif"
        fontWeight="800"
        fontSize={dims.subtitleSize}
        fill="#1e3a5f"
        letterSpacing="-0.01em"
      >
        Academy
      </text>

      {/* Right child standing */}
      <g transform={`translate(${dims.fullW * 0.78}, ${dims.fullH * 0.22}) scale(${dims.blockScale})`}>
        <ChildStanding />
        {/* Steps / stairs */}
        <g transform="translate(26, 42)" opacity="0.35">
          <line x1="0" y1="0" x2="22" y2="0" stroke="#1e3a5f" strokeWidth="2" />
          <line x1="4" y1="7" x2="26" y2="7" stroke="#1e3a5f" strokeWidth="2" />
          <line x1="8" y1="14" x2="30" y2="14" stroke="#1e3a5f" strokeWidth="2" />
        </g>
      </g>

      {/* Tagline */}
      {showTagline && (
        <text
          x={dims.fullW * 0.5}
          y={dims.fullH * 0.94 + 12}
          textAnchor="middle"
          fontFamily="'Nunito', sans-serif"
          fontWeight="700"
          fontSize={dims.taglineSize}
          fill="#6b7280"
          letterSpacing="0.16em"
          textTransform="uppercase"
        >
          FROM BLESSINGS TO PILLARS
        </text>
      )}
    </svg>
  );
}

/* ── Building blocks ── */

function Block({ x, y, color, letter }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect width="20" height="20" rx="3" fill={color} />
      <rect x="1" y="1" width="18" height="18" rx="2.5" fill={color} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      <text
        x="10"
        y="15"
        textAnchor="middle"
        fontFamily="'Nunito', sans-serif"
        fontWeight="900"
        fontSize="13"
        fill="white"
      >
        {letter}
      </text>
    </g>
  );
}

function ChildPushing() {
  // Silhouette of a small child pushing/stacking blocks
  return (
    <g fill="#1e3a5f">
      {/* Head */}
      <circle cx="6" cy="12" r="6" />
      {/* Body */}
      <path d="M3 18 C3 18 1 32 2 40 L5 40 L7 28 L9 40 L12 40 C11 32 9 18 9 18 Z" />
      {/* Arms reaching up/right */}
      <path d="M9 22 L18 14 L18 17 L10 24 Z" />
    </g>
  );
}

function ChildStanding() {
  // Silhouette of a child standing with hands on hips
  return (
    <g fill="#1e3a5f">
      {/* Head */}
      <circle cx="12" cy="8" r="7" />
      {/* Body */}
      <path d="M8 15 C8 15 6 34 7 46 L11 46 L13 30 L15 46 L19 46 C18 34 16 15 16 15 Z" />
      {/* Arms on hips */}
      <path d="M8 18 L1 28 L4 30 L8 24 Z" />
      <path d="M16 18 L23 28 L20 30 L16 24 Z" />
    </g>
  );
}

/* ── Sizes ── */

const SIZES = {
  sm: { icon: 32, fullW: 200, fullH: 70, titleSize: 22, subtitleSize: 18, taglineSize: 6, blockScale: 0.5 },
  md: { icon: 44, fullW: 280, fullH: 90, titleSize: 28, subtitleSize: 22, taglineSize: 7.5, blockScale: 0.65 },
  lg: { icon: 56, fullW: 380, fullH: 120, titleSize: 38, subtitleSize: 30, taglineSize: 9, blockScale: 0.85 },
  xl: { icon: 72, fullW: 500, fullH: 160, titleSize: 50, subtitleSize: 40, taglineSize: 11, blockScale: 1.1 },
};
