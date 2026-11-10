import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import AmerisLogo from "@/components/ui/AmerisLogo";
import { SOLUTIONS_INFO, SOLUTIONS_NAV } from "./siteInfo";

// The Ameris Solutions website (client mockups 2026-11-06): the sunrise
// banner header with the logo and menu, and the navy footer. Served under
// /solutions until the amerissolutions.com domain points at this server.

export const NAVY = "text-[#0b2a5b]";
export const BTN =
  "inline-flex items-center justify-center rounded-xl bg-[#0b2a5b] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78] focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200";
export const BTN_OUTLINE =
  "inline-flex items-center justify-center rounded-xl border-2 border-[#0b2a5b] bg-white px-5 py-2.5 text-sm font-bold text-[#0b2a5b] transition hover:bg-blue-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200";

function Icon({ name, className = "h-5 w-5" }) {
  const paths = {
    mail: "M3 5.5A1.5 1.5 0 014.5 4h11A1.5 1.5 0 0117 5.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 14.5v-9zm1.6.4L10 10l5.4-4.1",
    phone: "M5 3h2.5l1.2 3.2-1.6 1.2a8.5 8.5 0 004.5 4.5l1.2-1.6L16 11.5V14a1.5 1.5 0 01-1.6 1.5C8.6 15.1 4.9 11.4 4.5 5.6A1.5 1.5 0 016 4",
    pin: "M10 18s5-4.6 5-9a5 5 0 10-10 0c0 4.4 5 9 5 9zm0-7a2 2 0 100-4 2 2 0 000 4z",
  };
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
export { Icon };

export default function SolutionsLayout({ title, description, children, hideQuoteButton = false }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pageTitle = title ? `${title} | ${SOLUTIONS_INFO.name}` : `${SOLUTIONS_INFO.name} | ${SOLUTIONS_INFO.tagline}`;
  const active = (href) => (href === "/solutions" ? router.pathname === "/solutions" : router.pathname.startsWith(href));

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={description || "A complete childcare management system that simplifies daily operations and supports student development."} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="flex min-h-screen flex-col bg-white font-sans text-gray-800">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <header className="relative bg-cover bg-center" style={{ backgroundImage: "url(/solutions/dreamy-sunrise-over-misty-mountains.jpg)" }}>
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white" aria-hidden="true" />
          <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link href="/solutions" className="block w-36 shrink-0 sm:w-44" aria-label="Ameris Solutions home">
              <AmerisLogo size="lg" showText={false} className="max-w-full" />
            </Link>
            <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
              {SOLUTIONS_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`border-b-2 pb-1 text-[15px] font-semibold ${NAVY} ${active(item.href) ? "border-[#0b2a5b]" : "border-transparent hover:border-blue-300"}`}
                  aria-current={active(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/login" className={`border-b-2 border-transparent pb-1 text-[15px] font-semibold ${NAVY} hover:border-blue-300`}>
                Login
              </Link>
              {!hideQuoteButton ? (
                <Link href="/solutions/request-quote" className={BTN}>
                  Request a Quote
                </Link>
              ) : null}
            </nav>
            <button
              type="button"
              className={`rounded-lg border border-blue-200 bg-white/80 px-3 py-2 text-sm font-bold md:hidden ${NAVY}`}
              aria-expanded={open}
              aria-controls="solutions-mobile-nav"
              onClick={() => setOpen((o) => !o)}
            >
              Menu
            </button>
          </div>
          {open ? (
            <nav id="solutions-mobile-nav" aria-label="Main" className="relative mx-4 mb-3 rounded-2xl border border-blue-100 bg-white p-3 shadow md:hidden">
              {[...SOLUTIONS_NAV, { href: "/login", label: "Login" }, { href: "/solutions/request-quote", label: "Request a Quote" }].map((item) => (
                <Link key={item.href} href={item.href} className={`block rounded-lg px-3 py-2 font-semibold ${NAVY} hover:bg-blue-50`}>
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </header>

        <main id="main-content" className="flex-1">
          {children}
        </main>

        <footer className="bg-[#0b2a5b] text-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="w-40 rounded-xl bg-white p-2">
              <AmerisLogo size="lg" showText={false} className="max-w-full" />
            </div>
            <ul className="space-y-2 text-sm md:border-l md:border-white/20 md:pl-8">
              <li className="flex items-center gap-3">
                <Icon name="mail" />
                <a href={`mailto:${SOLUTIONS_INFO.supportEmail}`} className="hover:underline">
                  {SOLUTIONS_INFO.supportEmail}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="phone" />
                <a href={`tel:${SOLUTIONS_INFO.phone.replace(/\D/g, "")}`} className="hover:underline">
                  {SOLUTIONS_INFO.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="pin" />
                {SOLUTIONS_INFO.shortLocation}
              </li>
            </ul>
            <div className="flex gap-4 text-sm">
              <Link href="/solutions/privacy" className="hover:underline">
                Privacy Policy
              </Link>
              <span aria-hidden="true">|</span>
              <Link href="/solutions/terms" className="hover:underline">
                Terms of Service
              </Link>
            </div>
          </div>
          <div className="border-t border-white/10 py-4 text-center text-xs text-white/70">
            © {new Date().getFullYear()} Kingston Laboratories LLC d/b/a Ameris Solutions
          </div>
        </footer>
      </div>
    </>
  );
}
