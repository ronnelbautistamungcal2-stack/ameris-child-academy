import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { MenuIcon, MoonIcon, SunIcon, XIcon } from "./icons";
import AmerisLogo from "@/components/ui/AmerisLogo";
import { PUBLIC_NAV_LINKS } from "./siteData";

// The navbar uses the tight (padding-cropped) logo and sizes it by height so
// the bar stays slim. Pages under the absolutely positioned navbar pad their
// first section by NAVBAR_OFFSET (logo height + py-2.5).
const LOGO_HEIGHT = "clamp(46px, 5.2vw, 68px)";
const LOGO_ASPECT = 1601 / 595;
export const NAVBAR_OFFSET = `calc(${LOGO_HEIGHT} + 1.25rem)`;

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
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="mx-auto flex w-full items-center justify-between gap-5 px-5 py-2.5 lg:px-8">
        <Link
          href="/"
          className="block shrink-0"
          style={{ height: LOGO_HEIGHT, width: `calc(${LOGO_HEIGHT} * ${LOGO_ASPECT})` }}
        >
          <AmerisLogo tight showText={false} className="drop-shadow-sm" style={{ width: "100%" }} />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 text-[13px] font-semibold text-slate-700 md:flex lg:gap-2">
          {PUBLIC_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "rounded-[6px] px-3.5 py-2 transition",
                activeMatcher(link.href)
                  ? "bg-[#2566b8] text-white shadow-[0_8px_18px_-12px_rgba(37,102,184,0.9)]"
                  : "hover:text-[#2566b8]",
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-white/80 bg-white/90 text-slate-700 transition hover:text-[#2566b8] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:text-sky-300"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link
            href="/login"
            className="hidden items-center rounded-[6px] bg-[#133a7c] px-6 py-2 text-[13px] font-bold text-white shadow-[0_10px_22px_-14px_rgba(19,58,124,0.9)] transition hover:bg-[#0f2f66] md:inline-flex"
          >
            Login
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-white/90 text-gray-700 md:hidden"
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
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
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
                className="mt-4 block rounded-2xl bg-[#19388f] px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-[#163179]"
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
