import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";
import { ADMIN_NAV_ITEMS } from "@/components/admin/adminNav";

export default function AdminLayout({ title, children }) {
  const { session, status, allowed } = useRequireRole(["ADMIN"], "/dashboard");
  if (status === "loading")
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!allowed)
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;

  return (
    <AppShell
      title={title ? `Admin — ${title}` : "Admin"}
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      userImageUrl={session?.user?.pictureUrl}
      userId={session?.user?.id}
      navItems={ADMIN_NAV_ITEMS}
      showBack={false}
    >
      {children}
    </AppShell>
  );
}
