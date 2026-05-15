import Image from "next/image";

const SOURCE_ASPECT_RATIO = "1767 / 890";

const SIZES = {
  sm: { maxWidth: 96 },
  md: { maxWidth: 136 },
  lg: { maxWidth: 184 },
  xl: { maxWidth: 232 },
};

export default function AmerisLogo({
  size = "md",
  showText = true,
  showTagline = false,
  className = "",
  style = {},
}) {
  const dims = SIZES[size] || SIZES.md;
  const imageSizes = `(max-width: 640px) 42vw, ${dims.maxWidth}px`;
  const alt = showTagline || showText
    ? "Ameris Academy logo with the tagline From Blessings to Pillars"
    : "Ameris Academy logo";

  return (
    <span
      className={`relative block shrink-0 overflow-hidden ${className}`.trim()}
      style={{
        width: `min(100%, ${dims.maxWidth}px)`,
        aspectRatio: SOURCE_ASPECT_RATIO,
        ...style,
      }}
    >
      <Image
        src="/ameris-logo-transparent.png"
        alt={alt}
        fill
        sizes={imageSizes}
        className="object-contain dark:hidden"
        draggable="false"
      />
      <Image
        src="/ameris-logo-dark.png"
        alt={alt}
        fill
        sizes={imageSizes}
        className="hidden object-contain dark:block"
        draggable="false"
      />
    </span>
  );
}
