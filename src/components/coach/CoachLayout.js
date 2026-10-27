import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";
import { COACH_NAV_ITEMS } from "@/components/coach/coachNav";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

// Supply Lists pages announce changes so the nav count refreshes right away.
export const SUPPLY_REQUESTS_CHANGED_EVENT = "supply-requests-changed";
const SUPPLY_HREF = "/coach/supply-lists";
const REFRESH_MS = 60 * 1000;

/** Pending supply requests, shown as a red count on Supply Lists (client request 2026-10-02). */
function usePendingSupplyRequests(enabled) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const refresh = () =>
      apiJson("/api/v1/supply-requests/pending-count")
        .then((res) => alive && setCount(Number(res?.count) || 0))
        .catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener(SUPPLY_REQUESTS_CHANGED_EVENT, refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(SUPPLY_REQUESTS_CHANGED_EVENT, refresh);
    };
  }, [enabled]);
  return count;
}

export default function CoachLayout({
  title,
  children,
  shellMaxWidthClassName,
  contentMaxWidthClassName,
}) {
  const { session, status, allowed } = useRequireRole(
    ["COACH", "ADMIN"],
    "/dashboard",
  );
  const pendingSupplies = usePendingSupplyRequests(allowed);
  const navItems = useMemo(
    () =>
      COACH_NAV_ITEMS.map((item) =>
        item.children?.some((child) => child.href === SUPPLY_HREF)
          ? { ...item, children: item.children.map((child) => (child.href === SUPPLY_HREF ? { ...child, badge: pendingSupplies } : child)) }
          : item,
      ),
    [pendingSupplies],
  );

  if (status === "loading")
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!allowed)
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;

  return (
    <AppShell
      title={title || "Coach"}
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      userImageUrl={session?.user?.pictureUrl}
      userId={session?.user?.id}
      navItems={navItems}
      shellMaxWidthClassName={shellMaxWidthClassName}
      contentMaxWidthClassName={contentMaxWidthClassName}
      backHref="/dashboard"
    >
      {children}
    </AppShell>
  );
}
