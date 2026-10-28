import Image from "next/image";

// The Ameris Solutions logo (client 2026-10-28) is used across the portals
// and the login page; the public home pages keep the Ameris Academy logo
// (`legacy`).
const SOLUTIONS_ASPECT_RATIO = "917 / 523";
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
  legacy = false,
  className = "",
  style = {},
}) {
  const dims = SIZES[size] || SIZES.md;
  const suffix = tight ? "-tight" : "";
  // The tight logo is stretched to fill the w-72 header column.
  const renderWidth = tight ? 288 : dims.maxWidth;
  const imageSizes = `(max-width: 640px) 42vw, ${renderWidth}px`;
  let alt = "Ameris Solutions logo with the tagline Helping Children Thrive";
  let lightSrc = "/ameris-solutions-logo.png";
  let darkSrc = "/ameris-solutions-logo-dark.png";
  let aspectRatio = SOLUTIONS_ASPECT_RATIO;
  if (legacy) {
    alt = showTagline || showText ? "Ameris Academy logo with the tagline From Blessings to Pillars" : "Ameris Academy logo";
    lightSrc = `/ameris-logo-transparent${suffix}.png`;
    darkSrc = `/ameris-logo-dark${suffix}.png`;
    aspectRatio = tight ? TIGHT_ASPECT_RATIO : SOURCE_ASPECT_RATIO;
  }

  return (
    <span
      className={`relative block shrink-0 overflow-hidden ${className}`.trim()}
      style={{
        width: `${dims.maxWidth}px`,
        maxWidth: "100%",
        aspectRatio,
        ...style,
      }}
    >
      <Image
        src={lightSrc}
        alt={alt}
        fill
        sizes={imageSizes}
        className="object-contain dark:hidden"
        draggable="false"
      />
      <Image
        src={darkSrc}
        alt={alt}
        fill
        sizes={imageSizes}
        className="hidden object-contain dark:block"
        draggable="false"
      />
    </span>
  );
}
