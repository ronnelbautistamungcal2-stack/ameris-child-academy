import AppShell from "@/components/shell/AppShell";
import { STAFF_NAV_ITEMS } from "@/components/staff/staffNav";
import { useRequireRole } from "@/hooks/useRequireRole";

export default function StaffLayout({
  title,
  children,
  shellMaxWidthClassName,
  contentMaxWidthClassName,
}) {
  const { session, status, allowed } = useRequireRole(["OTHER_STAFF"], "/dashboard");

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
      navItems={STAFF_NAV_ITEMS}
      shellMaxWidthClassName={shellMaxWidthClassName}
      contentMaxWidthClassName={contentMaxWidthClassName}
      showBack={false}
    >
      {children}
    </AppShell>
  );
}
