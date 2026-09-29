import Image from "next/image";

const SOURCE_ASPECT_RATIO = "1767 / 890";
// The -tight files are the same artwork with the transparent padding cropped
// off, for places where the logo should fill its box (the portal top bar).
const TIGHT_ASPECT_RATIO = "1601 / 595";

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
  tight = false,
  className = "",
  style = {},
}) {
  const dims = SIZES[size] || SIZES.md;
  const suffix = tight ? "-tight" : "";
  // The tight logo is stretched to fill the w-72 header column.
  const renderWidth = tight ? 288 : dims.maxWidth;
  const imageSizes = `(max-width: 640px) 42vw, ${renderWidth}px`;
  const alt = showTagline || showText
    ? "Ameris Academy logo with the tagline From Blessings to Pillars"
    : "Ameris Academy logo";

  return (
    <span
      className={`relative block shrink-0 overflow-hidden ${className}`.trim()}
      style={{
        width: `${dims.maxWidth}px`,
        maxWidth: "100%",
        aspectRatio: tight ? TIGHT_ASPECT_RATIO : SOURCE_ASPECT_RATIO,
        ...style,
      }}
    >
      <Image
        src={`/ameris-logo-transparent${suffix}.png`}
        alt={alt}
        fill
        sizes={imageSizes}
        className="object-contain dark:hidden"
        draggable="false"
      />
      <Image
        src={`/ameris-logo-dark${suffix}.png`}
        alt={alt}
        fill
        sizes={imageSizes}
        className="hidden object-contain dark:block"
        draggable="false"
      />
    </span>
  );
}
