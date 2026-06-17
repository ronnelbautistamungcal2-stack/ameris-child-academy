import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { LoginUserIcon, MenuIcon, XIcon } from "./icons";
import AmerisLogo from "@/components/ui/AmerisLogo";
import { PUBLIC_NAV_LINKS } from "./siteData";

export default function PublicNavbar() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
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
      <div className="mx-auto flex w-full items-center justify-between gap-5 px-5 py-4 lg:px-8">
        <Link href="/" className="block w-[clamp(170px,22vw,270px)] shrink-0">
          <AmerisLogo size="xl" showText={false} className="drop-shadow-sm" />
        </Link>

        <nav className="hidden items-center gap-5 text-[12px] font-semibold text-slate-700 md:flex lg:gap-6">
          {PUBLIC_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "rounded-full px-1 py-1 transition",
                activeMatcher(link.href)
                  ? "text-[#19388f]"
                  : "hover:text-[#19388f]",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden items-center gap-2 rounded-[10px] bg-[#19388f] px-3.5 py-2 text-[12px] font-extrabold text-white shadow-[0_12px_24px_-18px_rgba(25,56,143,0.9)] transition hover:bg-[#163179] md:inline-flex"
          >
            <LoginUserIcon className="h-[13px] w-[13px]" />
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
