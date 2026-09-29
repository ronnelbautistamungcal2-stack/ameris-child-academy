import Image from "next/image";
import PublicLayout from "@/components/public/PublicLayout";

const RESOURCES = [
  {
    title: "Child Care Licensing (OCC)",
    description:
      "Utah Office of Child Care (OCC) – licensing information, rules, and resources.",
    href: "https://childcarelicensing.utah.gov",
  },
  {
    title: "WIC",
    description:
      "Women, Infants, and Children nutrition program. Support for healthy families.",
    href: "https://wic.utah.gov",
  },
  {
    title: "SNAP",
    description: "Supplemental Nutrition Assistance Program. Help with food benefits.",
    href: "https://jobs.utah.gov/assistance/food",
  },
  {
    title: "CACFP",
    description: "Child and Adult Care Food Program. Nutrition for children in care.",
    href: "https://www.fns.usda.gov/cacfp",
  },
  {
    title: "DWS Benefits Application",
    description:
      "Apply for child care subsidies and other family benefits through Utah's Department of Workforce Services (DWS).",
    href: "https://jobs.utah.gov/mycase",
  },
  {
    title: "DWS Rules & Information",
    description: "Policies, handbooks, and resources for child care subsidy programs.",
    href: "https://jobs.utah.gov/occ/",
  },
  {
    title: "High Quality Rating Scale (QRIS)",
    description:
      "Learn about Utah's QRIS system and quality standards for early childhood programs.",
    href: "https://childcarelicensing.utah.gov/quality-rating-improvement-system",
  },
  {
    title: "Top Star",
    description: "Utah's quality rating and improvement system for child care providers.",
    href: "https://jobs.utah.gov/occ/top-star",
  },
  {
    title: "Additional Resources",
    description:
      "Explore more helpful links for families, child care providers, and community support services.",
    href: "https://jobs.utah.gov/occ/resources",
  },
];

// Height of the absolutely positioned public navbar: logo width / logo aspect + py-4.
const NAVBAR_OFFSET = "calc(clamp(170px, 22vw, 270px) / 1.985 + 2rem)";

export default function ResourcesPage() {
  return (
    <PublicLayout
      title="Resources"
      description="Helpful information and links for families and our community."
    >
      <div className="bg-white font-serif">
        <HeroSection />
        <ResourceList />
      </div>
    </PublicLayout>
  );
}

function HeroSection() {
  return (
    <section className="relative" style={{ paddingTop: NAVBAR_OFFSET }}>
      {/* Phones: heading sits above the photo so it never covers the blocks. */}
      <HeroText className="px-6 pb-2 pt-4 md:hidden" />

      <div className="relative aspect-[551/250] w-full overflow-hidden md:aspect-[551/220]">
        <Image
          src="/uploads/resource-banner.png"
          alt="Wooden blocks reading Stronger Families, Brighter Children, Healthier Communities beside a Community Resources mug"
          fill
          sizes="100vw"
          priority
          className="object-cover object-[75%_center] md:object-center"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[14%] bg-gradient-to-b from-white/85 to-transparent" />
        <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-white via-white/40 to-transparent md:block" />

        <div className="absolute inset-0 hidden md:block">
          <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col justify-center px-6 pb-[7%] lg:px-10">
            <HeroText className="max-w-[440px]" />
          </div>
        </div>

        <Wave className="absolute inset-x-0 bottom-0 h-[clamp(28px,6vw,86px)] w-full" />
      </div>
    </section>
  );
}

function HeroText({ className = "" }) {
  return (
    <div className={className}>
      <h1 className="text-[clamp(2.75rem,6.5vw,5.25rem)] font-bold leading-none tracking-tight text-[#1b3f8f]">
        Resources
      </h1>
      <span className="mt-4 block h-[2px] w-full max-w-[440px] bg-[#9dbde6]" aria-hidden="true" />
      <p className="mt-4 max-w-[400px] text-[clamp(1.05rem,1.7vw,1.45rem)] leading-snug text-slate-700">
        Helpful information and links for families and our community.
      </p>
    </div>
  );
}

function ResourceList() {
  return (
    <section className="pb-16 sm:pb-20">
      <ul className="mx-auto w-full max-w-[1200px] divide-y divide-[#c9dcf3] px-6 lg:px-10">
        {RESOURCES.map((resource) => (
          <li key={resource.title} className="py-4">
            <h2 className="text-[clamp(1.35rem,2.2vw,1.75rem)] font-bold leading-tight text-[#1b3f8f]">
              {resource.title}
            </h2>
            <p className="mt-1 text-[14px] leading-6 text-slate-800 sm:text-[15px]">
              {resource.description}
            </p>
            <a
              href={resource.href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-[14px] text-[#2566b8] underline underline-offset-2 transition hover:text-[#1b3f8f] sm:text-[15px]"
            >
              {resource.href}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Layered blue waves that sweep the photo into the resource list. */
function Wave({ className = "" }) {
  return (
    <svg
      viewBox="0 0 1440 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    >
      <path d="M0 50 C 260 12, 520 16, 760 46 S 1220 88, 1440 36 L1440 100 L0 100 Z" fill="#c9dcf3" opacity="0.85" />
      <path d="M0 68 C 300 36, 580 42, 840 66 S 1250 92, 1440 56 L1440 100 L0 100 Z" fill="#7faee3" opacity="0.5" />
      <path d="M0 82 C 330 60, 640 68, 920 84 S 1290 94, 1440 76 L1440 100 L0 100 Z" fill="#ffffff" />
    </svg>
  );
}
