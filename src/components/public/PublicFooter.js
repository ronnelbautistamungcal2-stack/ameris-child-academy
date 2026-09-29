import Image from "next/image";
import Link from "next/link";
import { SITE_NAME } from "./siteData";

const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/programs", label: "Programs" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
  { href: "/login", label: "Login" },
];

export default function PublicFooter() {
  return (
    <footer className="relative bg-[#0f3472] text-white">
      {/* Wave sits above the footer so the section before it shows through the curve. */}
      <svg
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-full block h-[48px] w-full sm:h-[72px]"
        aria-hidden="true"
      >
        <path
          d="M0,52 C240,4 520,6 760,34 C1000,62 1240,58 1440,20 L1440,90 L0,90 Z"
          fill="#2d63b3"
          opacity="0.55"
        />
        <path
          d="M0,70 C260,22 540,24 780,50 C1020,76 1250,70 1440,38 L1440,90 L0,90 Z"
          fill="#0f3472"
        />
      </svg>

      <div className="mx-auto w-full max-w-[1280px] px-6 pb-6 pt-6 lg:px-10">
        <div className="flex flex-col items-center gap-6 md:flex-row md:gap-10">
          <Link href="/" className="relative block aspect-[1767/890] w-[200px] shrink-0 sm:w-[230px]">
            <Image
              src="/ameris-logo-dark.png"
              alt={`${SITE_NAME} logo`}
              fill
              sizes="230px"
              className="object-contain"
            />
          </Link>

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center justify-center text-[13px] text-white/90 md:border-l md:border-white/35 md:pl-6"
          >
            {FOOTER_LINKS.map((link, index) => (
              <span key={link.href} className="flex items-center">
                {index > 0 && <span className="mx-3 h-3.5 w-px bg-white/45" aria-hidden="true" />}
                <Link href={link.href} className="py-1 transition hover:text-white hover:underline">
                  {link.label}
                </Link>
              </span>
            ))}
          </nav>
        </div>

        <div className="mt-6 border-t border-white/25 pt-5 text-center text-[12.5px] leading-6 text-white/90">
          <p>{SITE_NAME} is an equal opportunity provider.</p>
          <p>
            We do not discriminate on the basis of race, color, national origin, sex, disability, or
            age in the provision of our programs and services.
          </p>
        </div>
      </div>
    </footer>
  );
}
