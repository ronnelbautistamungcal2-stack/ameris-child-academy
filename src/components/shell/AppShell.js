import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useTheme } from "@/contexts/ThemeContext";

export default function AppShell({
  title,
  userName,
  userLabel,
  userImageUrl,
  userId,
  navItems,
  children,
  right,
  backHref = "/dashboard",
  backLabel = "Back",
  showBack,
  showFooter = true,
}) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showBackComputed = useMemo(() => {
    if (typeof showBack === "boolean") return showBack;
    return !!backHref && backHref !== "/dashboard";
  }, [showBack, backHref]);

  const activePath = (router.asPath || "/").split("?")[0] || "/";
  const userDisplay = userName || userLabel || "Account";
  const settingsLabel = useMemo(() => {
    function findInItems(items) {
      for (const i of items || []) {
        if (i?.href === "/settings") return i.label;
        if (i?.children) {
          const found = findInItems(i.children);
          if (found) return found;
        }
      }
      return null;
    }
    return findInItems(navItems) || "Account Settings";
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

  const isActive = useCallback(
    (href) => {
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
    },
    [activePath],
  );

  const Sidebar = (
    <aside className="sticky top-0 flex h-screen w-72 flex-col border-r border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
      <div className="px-6 pb-5 pt-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-100 text-sm font-extrabold text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
            ACA
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100">
              Ameris Academy
            </div>
            <div className="truncate text-xs text-gray-500 dark:text-gray-400">Childcare</div>
          </div>
        </Link>
      </div>

      <nav className="scrollbar-hide flex-1 overflow-y-auto px-4 pb-6">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Navigation
        </div>
        <div className="space-y-1">
          {(navItems || []).map((item, idx) => {
            if (!item) return null;

            // Collapsible group with children
            if (item.children) {
              return (
                <NavGroup
                  key={`group:${item.label || idx}`}
                  label={item.label}
                  items={item.children}
                  isActive={isActive}
                  activePath={activePath}
                />
              );
            }

            if (!item.href) return null;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                  active
                    ? "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800",
                ].join(" ")}
              >
                <span className="truncate">{item.label}</span>
                {item.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-gray-50 dark:from-gray-900 dark:to-gray-950">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <div className="hidden md:block">{Sidebar}</div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-gray-900/40 dark:bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] shadow-xl">
              {Sidebar}
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/70 backdrop-blur dark:border-gray-700 dark:bg-gray-900/70">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 md:hidden"
                  aria-label="Open navigation"
                  onClick={() => setMobileOpen(true)}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <NotificationBell userId={userId} />
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  aria-label="Toggle theme"
                  onClick={toggleTheme}
                >
                  {theme === "dark" ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5" />
                      <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z"
                      />
                    </svg>
                  )}
                </button>

                <div className="hidden items-center gap-3 pl-2 sm:flex">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{userDisplay}</div>
                    <Link href="/settings" className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300">
                      {settingsLabel}
                    </Link>
                  </div>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="h-10 w-10 rounded-full border border-gray-200 object-cover dark:border-gray-600"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      {initials}
                    </div>
                  )}
                </div>

                {showBackComputed && backHref ? (
                  <Link
                    href={backHref}
                    className="hidden rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 md:inline-flex"
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
            <footer className="border-t border-gray-200 bg-white/70 backdrop-blur dark:border-gray-700 dark:bg-gray-900/70">
              <div className="mx-auto w-full max-w-6xl px-4 py-10">
                <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-100 text-sm font-extrabold text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                        ACA
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100">
                          Ameris Academy
                        </div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                          Childcare
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 max-w-sm text-sm text-gray-600 dark:text-gray-400">
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
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Newsletter
                    </div>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
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
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
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

                <div className="mt-10 border-t border-gray-200 pt-6 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
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

function NavGroup({ label, items, isActive, activePath }) {
  const hasActiveChild = items.some((i) => i.href && isActive(i.href));
  const [open, setOpen] = useState(hasActiveChild);

  // Auto-open when navigating into this group
  useEffect(() => {
    if (hasActiveChild && !open) setOpen(true);
  }, [activePath]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
          hasActiveChild
            ? "text-sky-700 dark:text-sky-300"
            : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800",
        ].join(" ")}
      >
        <span className="truncate">{label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={[
            "h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500",
            open ? "rotate-180" : "",
          ].join(" ")}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
          {items.map((child) => {
            if (!child?.href) return null;
            const active = isActive(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={[
                  "flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium transition",
                  active
                    ? "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
                ].join(" ")}
              >
                <span className="truncate">{child.label}</span>
                {child.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white">
                    {child.badge > 99 ? "99+" : child.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.label}>
            <a href={item.href} className="text-gray-700 hover:text-sky-700 dark:text-gray-300 dark:hover:text-sky-400">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
