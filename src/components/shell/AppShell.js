import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useTheme } from "@/contexts/ThemeContext";
import AmerisLogo from "@/components/ui/AmerisLogo";
import { roleHomePath, roleLabel } from "@/lib/roles";

export default function AppShell({
  title,
  userName,
  userLabel,
  userImageUrl,
  userId,
  navItems,
  children,
  right,
  shellMaxWidthClassName = "max-w-[1500px]",
  contentMaxWidthClassName = "max-w-6xl",
  backHref = "/dashboard",
  backLabel = "Back",
  showBack,
  showFooter = false,
}) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const mainContentId = "app-shell-main";

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
  const activeRole = session?.user?.role || "";
  const availableRoles = Array.from(
    new Set(
      Array.isArray(session?.user?.roles)
        ? session.user.roles.filter(Boolean)
        : activeRole
          ? [activeRole]
          : [],
    ),
  );

  const initials = useMemo(() => {
    const src = (userName || userLabel || "").trim();
    if (!src) return "U";
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    const single = parts[0];
    if (single.includes("@")) return single.slice(0, 2).toUpperCase();
    return single.slice(0, 2).toUpperCase();
  }, [userName, userLabel]);

  const handleRoleSwitch = useCallback(
    async (nextRole) => {
      const role = String(nextRole || "").toUpperCase();
      if (!role || role === activeRole) return;
      await update({ user: { role } });
      router.push(roleHomePath(role));
    },
    [activeRole, router, update],
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [router.asPath]);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen]);

  const isActive = useCallback(
    (href) => {
      const exactOnly = new Set([
        "/dashboard",
        "/admin",
        "/teacher",
        "/staff",
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
    <aside className="sticky top-0 flex h-screen w-72 flex-col border-r border-white/60 bg-white/75 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/85">
      <div className="px-6 pb-5 pt-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <AmerisLogo size="sm" showText={false} className="h-11 w-11 rounded-2xl shadow-md shadow-blue-200 dark:shadow-blue-900/40" />
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100">
              Ameris Academy
            </div>
            <div className="truncate text-xs font-semibold text-blue-700 dark:text-blue-400">
              Operations Platform
            </div>
          </div>
        </Link>
      </div>

      <nav className="scrollbar-hide flex-1 overflow-y-auto px-4 pb-6" aria-label="Primary navigation">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-blue-300 dark:text-blue-500">
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
                  icon={item.icon}
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
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-bold transition-all duration-150",
                  active
                    ? "bg-gradient-to-r from-blue-100 to-sky-50 text-blue-900 shadow-sm dark:bg-blue-900/40 dark:from-blue-900/40 dark:to-sky-900/20 dark:text-blue-200"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-800 dark:text-gray-300 dark:hover:bg-gray-800",
                ].join(" ")}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon ? (
                    <span className={active ? "text-blue-700 dark:text-blue-300" : "text-gray-400 dark:text-gray-500"}>
                      {item.icon}
                    </span>
                  ) : null}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-1 text-[10px] font-extrabold text-white shadow-sm">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/50 to-amber-50/40 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <a href={`#${mainContentId}`} className="skip-link">
        Skip to main content
      </a>
      <div className={["mx-auto flex min-h-screen w-full", shellMaxWidthClassName].join(" ")}>
        <div className="hidden md:block">{Sidebar}</div>

        {mobileOpen ? (
          <MobileSidebar
            onClose={() => setMobileOpen(false)}
            triggerRef={menuButtonRef}
          >
            {Sidebar}
          </MobileSidebar>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-white/60 bg-white/70 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/70">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  ref={menuButtonRef}
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 md:hidden"
                  aria-label="Open navigation"
                  aria-controls="app-shell-mobile-nav"
                  aria-expanded={mobileOpen}
                  onClick={() => setMobileOpen(true)}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                {title ? (
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100 md:text-base">
                      {title}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <NotificationBell userId={userId} />
                <RoleSwitcher
                  activeRole={activeRole}
                  availableRoles={availableRoles}
                  onSwitch={handleRoleSwitch}
                />
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
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
                      alt={userDisplay}
                      className="h-10 w-10 rounded-full border border-gray-200 object-cover dark:border-gray-600"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-sm font-extrabold text-white shadow-md shadow-blue-200 dark:shadow-blue-900/40">
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
                  className="rounded-2xl bg-gradient-to-r from-red-500 to-red-600 px-2.5 py-2 text-xs font-extrabold text-white shadow-sm transition-all hover:shadow-md hover:from-red-600 hover:to-red-700 sm:px-4 sm:text-sm"
                >
                  <span className="hidden sm:inline">Sign Out</span>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 sm:hidden">
                    <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          <main id={mainContentId} className="px-4 py-6" tabIndex={-1}>
            <div className={["mx-auto w-full", contentMaxWidthClassName].join(" ")}>
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
            <footer className="border-t border-white/60 bg-white/70 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/70">
              <div className="mx-auto w-full max-w-6xl px-4 py-10">
                <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <AmerisLogo size="sm" showText={false} className="h-10 w-10 rounded-2xl shadow-md shadow-blue-200 dark:shadow-blue-900/40" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100">
                          Ameris Academy
                        </div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                          Operations Platform
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 max-w-sm text-sm text-gray-600 dark:text-gray-400">
                      A shared workspace for admins, teachers, coaches, and
                      families to stay aligned on daily operations and child
                      support.
                    </p>
                  </div>

                  <FooterCol
                    title="Support"
                    items={["Center Support", "Platform Help", "Status Updates"]}
                  />

                  <FooterCol
                    title="Legal"
                    items={["Privacy Policy", "Terms of Service", "Cookie Policy"]}
                  />

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Platform Updates
                    </div>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Release notes and shared guidance will appear here as the
                      platform rollout continues.
                    </div>
                    <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 6l6 6-6 6" />
                      </svg>
                      Rolling out soon
                    </p>
                  </div>
                </div>

                <div className="mt-10 border-t border-gray-200 pt-6 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Copyright {new Date().getFullYear()} Ameris Academy. All rights
                  reserved.
                </div>
              </div>
            </footer>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NavGroup({ label, icon, items, isActive, activePath }) {
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
          "flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-bold transition-all duration-150",
          hasActiveChild
            ? "text-blue-800 dark:text-blue-300"
            : "text-gray-600 hover:bg-blue-50 hover:text-blue-800 dark:text-gray-300 dark:hover:bg-gray-800",
        ].join(" ")}
      >
        <span className="flex items-center gap-2.5 truncate">
          {icon ? (
            <span className={hasActiveChild ? "text-blue-700 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}>
              {icon}
            </span>
          ) : null}
          <span className="truncate">{label}</span>
        </span>
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
        <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-blue-100 pl-3 dark:border-gray-700">
          {items.map((child) => {
            if (!child?.href) return null;
            const active = isActive(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-bold transition-all duration-150",
                  active
                    ? "bg-gradient-to-r from-blue-100 to-sky-50 text-blue-900 dark:bg-blue-900/40 dark:from-blue-900/40 dark:to-sky-900/20 dark:text-blue-200"
                    : "text-gray-500 hover:bg-blue-50 hover:text-blue-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
                ].join(" ")}
              >
                <span className="truncate">{child.label}</span>
                {child.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-1 text-[10px] font-extrabold text-white shadow-sm">
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
        {items.map((label) => (
          <li key={label} className="text-gray-500 dark:text-gray-400">
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleSwitcher({ activeRole, availableRoles, onSwitch }) {
  const [open, setOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState("");
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();
  const activeLabel = roleLabel(activeRole);

  useEffect(() => {
    setOpen(false);
  }, [activeRole]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      const target = event.target;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = useCallback(
    async (nextRole) => {
      const role = String(nextRole || "").toUpperCase();
      if (!role || role === activeRole || pendingRole) return;

      setPendingRole(role);
      try {
        await onSwitch(role);
        setOpen(false);
      } catch (error) {
        console.error("Failed to switch role", error);
      } finally {
        setPendingRole("");
      }
    },
    [activeRole, onSwitch, pendingRole],
  );

  if (availableRoles.length <= 1) return null;

  return (
    <div className="relative hidden md:block">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        aria-label={`Switch role. Current role: ${activeLabel}.`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={[
              "h-2.5 w-2.5 shrink-0 rounded-full",
              getRoleDotClass(activeRole),
            ].join(" ")}
          />
          <span className="hidden text-xs font-medium text-gray-500 dark:text-gray-400 lg:inline">
            Role
          </span>
          <span className="max-w-[7rem] truncate">
            {activeLabel}
          </span>
        </span>
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

      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          role="menu"
          aria-label="Switch role"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 min-w-[11rem] rounded-2xl border border-gray-200 bg-white p-1 shadow-lg animate-[fadeIn_0.14s_ease-out] dark:border-gray-700 dark:bg-gray-900"
        >
          {availableRoles.map((role) => {
            const current = role === activeRole;
            const busy = pendingRole === role;

            return (
              <button
                key={role}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                onClick={() => handleSelect(role)}
                disabled={Boolean(pendingRole)}
                className={[
                  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  current
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100",
                  busy ? "cursor-wait opacity-70" : "",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={[
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      getRoleDotClass(role),
                    ].join(" ")}
                  />
                  <span className="truncate">{roleLabel(role)}</span>
                </span>
                {current ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 010 1.42l-7.24 7.24a1 1 0 01-1.414 0l-3.26-3.26a1 1 0 111.414-1.414l2.553 2.553 6.533-6.533a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MobileSidebar({ onClose, children, triggerRef }) {
  const sidebarRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !sidebarRef.current) return;

      const focusable = sidebarRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef?.current?.focus?.();
    };
  }, [onClose, triggerRef]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <div
        className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 animate-[overlayIn_0.2s_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id="app-shell-mobile-nav"
        ref={sidebarRef}
        className="absolute inset-y-0 left-0 w-80 max-w-[85vw] shadow-xl animate-[slideInLeft_0.25s_ease-out]"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

function getRoleDotClass(role) {
  switch (String(role || "").toUpperCase()) {
    case "ADMIN":
      return "bg-sky-500";
    case "TEACHER":
      return "bg-emerald-500";
    case "OTHER_STAFF":
      return "bg-cyan-500";
    case "COACH":
      return "bg-amber-500";
    case "PARENT":
      return "bg-rose-500";
    case "SUBSCRIBER":
      return "bg-cyan-500";
    default:
      return "bg-gray-400";
  }
}
