import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";
import { PARENT_NAV_ITEMS } from "@/components/parent/parentNav";

export default function ParentLayout({ title, children }) {
  const { session, status, allowed } = useRequireRole(["PARENT"], "/dashboard");
  if (status === "loading")
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!allowed)
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;

  return (
    <AppShell
      title={title || "Parent"}
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      userImageUrl={session?.user?.pictureUrl}
      navItems={PARENT_NAV_ITEMS}
      backHref="/dashboard"
    >
      {children}
    </AppShell>
  );
}
