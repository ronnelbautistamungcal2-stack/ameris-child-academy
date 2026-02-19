import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { MoonIcon, MenuIcon, XIcon } from "./icons";

const NAV_LINKS = [
  { href: "/programs", label: "Programs & Curriculum" },
  { href: "/resources", label: "Resources" },
  { href: "/calendar", label: "Calendar" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
];

export default function PublicNavbar() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activePath = (router.asPath || "/").split("?")[0];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-100 text-sm font-extrabold text-sky-700">
            ACA
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-gray-900">Ameris Academy</div>
            <div className="truncate text-xs text-gray-500">Childcare</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "rounded-2xl px-4 py-2 text-sm font-semibold transition",
                activePath === link.href
                  ? "bg-sky-50 text-sky-700"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700"
            aria-label="Theme"
          >
            <MoonIcon />
          </button>
          <Link
            href="/login"
            className="hidden rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-sky-700 sm:inline-flex"
          >
            Login
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-80 max-w-[85vw] bg-white shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <span className="text-sm font-extrabold text-gray-900">Menu</span>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 text-gray-700"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <XIcon />
              </button>
            </div>
            <nav className="px-4 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={[
                    "block rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    activePath === link.href
                      ? "bg-sky-50 text-sky-700"
                      : "text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="mt-4 block rounded-2xl bg-sky-600 px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-sky-700"
              >
                Login
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
