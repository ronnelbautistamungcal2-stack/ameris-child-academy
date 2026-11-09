import AppShell from "@/components/shell/AppShell";
import { GLOBAL_NAV_ITEMS } from "@/components/global/globalNav";
import { useRequireRole } from "@/hooks/useRequireRole";

const ROLES = ["GLOBAL_ADMIN"];

export default function GlobalLayout({ title, children }) {
  const { session, status, allowed } = useRequireRole(ROLES, "/dashboard");
  if (status === "loading") return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!allowed) return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;

  return (
    <AppShell
      title={title ? `Ameris Solutions - ${title}` : "Ameris Solutions"}
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      userImageUrl={session?.user?.pictureUrl}
      userId={session?.user?.id}
      navItems={GLOBAL_NAV_ITEMS}
      shellMaxWidthClassName="max-w-[1760px]"
      contentMaxWidthClassName="max-w-[1400px]"
      showBack={false}
    >
      {children}
    </AppShell>
  );
}
