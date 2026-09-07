import AppShell from "@/components/shell/AppShell";
import { buildStaffNavItems } from "@/components/staff/staffNav";
import { useRequireRole } from "@/hooks/useRequireRole";
import { isKitchenStaff } from "@/lib/roles";
import { useMemo } from "react";

export default function StaffLayout({
  title,
  children,
  shellMaxWidthClassName,
  contentMaxWidthClassName,
}) {
  const { session, status, allowed } = useRequireRole(["OTHER_STAFF"], "/dashboard");
  const navItems = useMemo(
    () => buildStaffNavItems({ isKitchenStaff: isKitchenStaff(session?.user) }),
    [session?.user],
  );

  if (status === "loading") {
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  }

  if (!allowed) {
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;
  }

  return (
    <AppShell
      title={title || "Other Staff"}
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
