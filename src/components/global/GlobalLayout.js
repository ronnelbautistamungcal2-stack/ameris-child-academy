import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/shell/AppShell";
import { GLOBAL_NAV_ITEMS } from "@/components/global/globalNav";
import { useRequireRole } from "@/hooks/useRequireRole";
import { apiJson } from "@/lib/api";

const ROLES = ["GLOBAL_ADMIN"];

// The signed-in team member's rights (Permissions & Users), fetched once per
// page load and shared by every Global admin page.
let rightsPromise = null;
function loadRights() {
  rightsPromise ||= apiJson("/api/v1/global/me").catch(() => {
    rightsPromise = null;
    return null;
  });
  return rightsPromise;
}

function visible(item, rights) {
  if (!item.section || !rights) return true;
  if (item.section === "USERS") return rights.manageUsers;
  return item.section.split("|").some((s) => (rights.permissions?.[s] || []).includes("VIEW"));
}

export default function GlobalLayout({ title, children }) {
  const { session, status, allowed } = useRequireRole(ROLES, "/dashboard");
  const [rights, setRights] = useState(null);
  useEffect(() => {
    if (allowed) loadRights().then(setRights);
  }, [allowed]);
  const navItems = useMemo(() => GLOBAL_NAV_ITEMS.filter((item) => visible(item, rights)), [rights]);

  if (status === "loading") return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!allowed) return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;

  return (
    <AppShell
      title={title ? `Ameris Solutions - ${title}` : "Ameris Solutions"}
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      userImageUrl={session?.user?.pictureUrl}
      userId={session?.user?.id}
      navItems={navItems}
      shellMaxWidthClassName="max-w-[1760px]"
      contentMaxWidthClassName="max-w-[1400px]"
      showBack={false}
    >
      {children}
    </AppShell>
  );
}
