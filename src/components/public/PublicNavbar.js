import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { MoonIcon, SunIcon, MenuIcon, XIcon } from "./icons";
import AmerisLogo from "@/components/ui/AmerisLogo";
import { PUBLIC_NAV_LINKS, SITE_NAME } from "./siteData";

export default function PublicNavbar() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const activePath = (router.asPath || "/").split("?")[0];
  const activeMatcher = useMemo(
    () => (href) => activePath === href || activePath.startsWith(`${href}/`),
    [activePath],
  );

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [router.asPath]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <AmerisLogo size="md" showText={false} className="drop-shadow-sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-gray-900">{SITE_NAME}</div>
            <div className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Early Learning</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/70 bg-white/70 p-1 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] lg:flex">
          {PUBLIC_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                activeMatcher(link.href)
                  ? "bg-sky-100 text-sky-900 shadow-sm"
                  : "text-gray-700 hover:bg-white hover:text-gray-900",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-gray-700 transition hover:bg-white"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link
            href="/login"
            className="hidden items-center rounded-2xl bg-gradient-to-r from-sky-700 via-cyan-600 to-blue-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_18px_36px_-24px_rgba(2,132,199,0.9)] transition hover:-translate-y-0.5 hover:from-sky-800 hover:to-blue-700 sm:inline-flex"
          >
            Family Portal
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-gray-700 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-controls="public-mobile-nav"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setMobileOpen(false)} />
          <div
            id="public-mobile-nav"
            className="absolute inset-y-0 right-0 w-80 max-w-[85vw] bg-white/95 shadow-xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
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
            <nav className="space-y-1 px-4 py-4">
              {PUBLIC_NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={[
                    "block rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    activeMatcher(link.href)
                      ? "bg-sky-50 text-sky-800"
                      : "text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="mt-4 block rounded-2xl bg-gradient-to-r from-blue-800 to-sky-600 px-4 py-3 text-center text-sm font-extrabold text-white hover:from-blue-900 hover:to-sky-700"
              >
                Open Family Portal
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
