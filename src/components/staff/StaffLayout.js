import AppShell from "@/components/shell/AppShell";
import { buildStaffNavItems } from "@/components/staff/staffNav";
import { useRequireRole } from "@/hooks/useRequireRole";
import { roleLabel, STAFF_PORTAL_ROLES } from "@/lib/roles";
import { useMemo } from "react";

/**
 * Pass `roles` to limit a page to some staff roles, e.g. HR pages to HR_STAFF.
 */
export default function StaffLayout({
  title,
  roles = STAFF_PORTAL_ROLES,
  children,
  shellMaxWidthClassName,
  contentMaxWidthClassName,
}) {
  const { session, status, allowed } = useRequireRole(roles, "/dashboard");
  const navItems = useMemo(
    () => buildStaffNavItems({ role: session?.user?.role }),
    [session?.user?.role],
  );

  if (status === "loading") {
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  }

  if (!allowed) {
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;
  }

  return (
    <AppShell
      title={title || roleLabel(session?.user?.role)}
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      userImageUrl={session?.user?.pictureUrl}
      userId={session?.user?.id}
      navItems={navItems}
      shellMaxWidthClassName={shellMaxWidthClassName}
      contentMaxWidthClassName={contentMaxWidthClassName}
      showBack={false}
    >
      {children}
    </AppShell>
  );
}
