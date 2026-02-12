import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

export default function AppShell({
  title,
  userName,
  userLabel,
  userImageUrl,
  navItems,
  children,
  right,
  backHref = "/dashboard",
  backLabel = "Back",
  showBack,
  showFooter = true,
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showBackComputed = useMemo(() => {
    if (typeof showBack === "boolean") return showBack;
    return !!backHref && backHref !== "/dashboard";
  }, [showBack, backHref]);

  const activePath = (router.asPath || "/").split("?")[0] || "/";
  const userDisplay = userName || userLabel || "Account";
  const settingsLabel = useMemo(() => {
    const match = (navItems || []).find((i) => i?.href === "/settings");
    return match?.label || "Account Settings";
  }, [navItems]);
  const avatarUrl = typeof userImageUrl === "string" && userImageUrl.trim() ? userImageUrl.trim() : "";

  const initials = useMemo(() => {
    const src = (userName || userLabel || "").trim();
    if (!src) return "U";
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    const single = parts[0];
    if (single.includes("@")) return single.slice(0, 2).toUpperCase();
    return single.slice(0, 2).toUpperCase();
  }, [userName, userLabel]);

  useEffect(() => {
    setMobileOpen(false);
  }, [router.asPath]);

  function isActive(href) {
    // Avoid marking "Overview" as active for every sub-route (e.g. /admin is not active on /admin/users).
    const exactOnly = new Set([
      "/dashboard",
      "/admin",
      "/teacher",
      "/parent",
      "/coach",
      "/subscriber",
      "/settings",
    ]);

    if (exactOnly.has(href)) return activePath === href;
    return activePath === href || activePath.startsWith(`${href}/`);
  }

  const Sidebar = (
    <aside className="sticky top-0 flex h-screen w-72 flex-col border-r border-gray-200 bg-white/90 backdrop-blur">
      <div className="px-6 pb-5 pt-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-100 text-sm font-extrabold text-sky-700">
            ACA
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-gray-900">
              Ameris Academy
            </div>
            <div className="truncate text-xs text-gray-500">Childcare</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 pb-6">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Navigation
        </div>
        <div className="space-y-1">
          {(navItems || []).map((item, idx) => {
            if (!item) return null;
            if (item.kind === "section") {
              return (
                <div
                  key={`section:${item.label || idx}`}
                  className="pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
                >
                  {item.label || "Section"}
                </div>
              );
            }

            if (!item.href) return null;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  active
                    ? "bg-sky-100 text-sky-900"
                    : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-gray-50">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <div className="hidden md:block">{Sidebar}</div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-gray-900/40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] shadow-xl">
              {Sidebar}
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/70 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 md:hidden"
                  aria-label="Open navigation"
                  onClick={() => setMobileOpen(true)}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700"
                  aria-label="Notifications"
                  onClick={() => alert("Notifications not implemented yet")}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"
                    />
                    <path strokeLinecap="round" d="M9 17a3 3 0 006 0" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700"
                  aria-label="Theme"
                  onClick={() => alert("Theme toggle not implemented yet")}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z"
                    />
                  </svg>
                </button>

                <div className="hidden items-center gap-3 pl-2 sm:flex">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{userDisplay}</div>
                    <Link href="/settings" className="text-xs font-semibold text-sky-600 hover:text-sky-700">
                      {settingsLabel}
                    </Link>
                  </div>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="h-10 w-10 rounded-full border border-gray-200 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-700">
                      {initials}
                    </div>
                  )}
                </div>

                {showBackComputed && backHref ? (
                  <Link
                    href={backHref}
                    className="hidden rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 md:inline-flex"
                  >
                    {backLabel}
                  </Link>
                ) : null}

                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-600"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </header>

          <main className="px-4 py-6">
            <div className="mx-auto w-full max-w-6xl">
              {right ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
                  <section className="min-w-0">{children}</section>
                  <aside className="min-w-0">{right}</aside>
                </div>
              ) : (
                children
              )}
            </div>
          </main>

          {showFooter ? (
            <footer className="border-t border-gray-200 bg-white/70 backdrop-blur">
              <div className="mx-auto w-full max-w-6xl px-4 py-10">
                <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-100 text-sm font-extrabold text-sky-700">
                        ACA
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-gray-900">
                          Ameris Academy
                        </div>
                        <div className="truncate text-xs text-gray-500">
                          Childcare
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 max-w-sm text-sm text-gray-600">
                      Providing high-quality care and education for children
                      since 2015. Shaping the leaders of tomorrow, today.
                    </p>
                  </div>

                  <FooterCol
                    title="Support"
                    items={[
                      { label: "Help Center", href: "#" },
                      { label: "Contact Support", href: "#" },
                      { label: "Technical Issues", href: "#" },
                    ]}
                  />

                  <FooterCol
                    title="Legal"
                    items={[
                      { label: "Privacy Policy", href: "#" },
                      { label: "Terms of Service", href: "#" },
                      { label: "Cookie Policy", href: "#" },
                    ]}
                  />

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Newsletter
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      Get the latest news and activity updates.
                    </div>
                    <form
                      className="mt-4 flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        alert("Newsletter signup not implemented yet");
                      }}
                    >
                      <input
                        type="email"
                        placeholder="Your email"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white hover:bg-sky-700"
                        aria-label="Subscribe"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 6l6 6-6 6" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>

                <div className="mt-10 border-t border-gray-200 pt-6 text-xs text-gray-500">
                  © {new Date().getFullYear()} Ameris Childcare Management. All rights reserved.
                </div>
              </div>
            </footer>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.label}>
            <a href={item.href} className="text-gray-700 hover:text-sky-700">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
