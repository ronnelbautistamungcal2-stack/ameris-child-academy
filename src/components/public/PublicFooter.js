import Link from "next/link";
import AmerisLogo from "@/components/ui/AmerisLogo";
import { MailIcon, MapPinIcon, PhoneIcon } from "./icons";
import { PUBLIC_CONTACT, PUBLIC_NAV_LINKS, SITE_TAGLINE } from "./siteData";

const PORTAL_LINKS = [
  { href: "/login", label: "Family Portal" },
  { href: "/contact", label: "Book a Visit" },
  { href: "/calendar", label: "Center Calendar" },
  { href: "/external-clients", label: "For Center Partners" },
];

export default function PublicFooter() {
  return (
    <footer className="border-t border-white/60 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.35fr_0.9fr_0.9fr_1.1fr]">
          <div className="min-w-0">
            <Link href="/" className="block w-[clamp(132px,34vw,188px)] sm:w-[clamp(148px,24vw,204px)]">
              <AmerisLogo size="xl" showText={false} className="drop-shadow-sm" />
            </Link>
            <p className="mt-4 max-w-sm text-sm text-gray-600">{SITE_TAGLINE}</p>
            <div className="mt-5 grid gap-3 text-sm text-gray-600">
              <a href={PUBLIC_CONTACT.phoneHref} className="flex items-start gap-3 rounded-2xl bg-white/85 px-4 py-3 hover:text-sky-700">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <PhoneIcon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-semibold text-gray-900">{PUBLIC_CONTACT.phoneDisplay}</span>
                  <span className="block text-xs">{PUBLIC_CONTACT.visitHours}</span>
                </span>
              </a>
              <a href={`mailto:${PUBLIC_CONTACT.email}`} className="flex items-start gap-3 rounded-2xl bg-white/85 px-4 py-3 hover:text-sky-700">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <MailIcon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-semibold text-gray-900">{PUBLIC_CONTACT.email}</span>
                  <span className="block text-xs">Questions about tours, enrollment, or family support.</span>
                </span>
              </a>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Explore</div>
            <ul className="mt-3 space-y-2 text-sm">
              {PUBLIC_NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-gray-700 hover:text-sky-700">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Helpful Links</div>
            <ul className="mt-3 space-y-2 text-sm">
              {PORTAL_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-gray-700 hover:text-sky-700">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-gradient-to-br from-sky-700 via-cyan-600 to-blue-700 p-6 text-white shadow-[0_24px_60px_-40px_rgba(2,132,199,0.85)]">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-100">Visit Us</div>
            <h2 className="mt-3 text-xl font-black tracking-tight">Make the first visit simple.</h2>
            <p className="mt-3 text-sm leading-6 text-sky-50">
              Book a tour, ask enrollment questions, and learn how daily updates, routines, and progress tracking work for your family.
            </p>
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
                <MapPinIcon className="h-4 w-4" />
              </span>
              <div>
                {PUBLIC_CONTACT.addressLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-sky-800 transition hover:bg-sky-50"
              >
                Schedule a Visit
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/30 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-white/10"
              >
                Open Portal
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-6 text-xs text-gray-500 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} Ameris Academy. All rights reserved.</span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href={PUBLIC_CONTACT.phoneHref} className="hover:text-sky-700">
              {PUBLIC_CONTACT.phoneDisplay}
            </a>
            <a href={`mailto:${PUBLIC_CONTACT.email}`} className="hover:text-sky-700">
              {PUBLIC_CONTACT.email}
            </a>
            <Link href="/contact" className="hover:text-sky-700">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
