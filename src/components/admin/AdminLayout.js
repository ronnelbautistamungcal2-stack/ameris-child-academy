import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin/users", label: "Access Controls" },
  { href: "/admin/invites", label: "Invite Codes" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/centers", label: "Centers" },
  { href: "/admin/classes", label: "Classrooms" },
  { href: "/admin/children", label: "Students" },
  { href: "/admin/lessons", label: "Lesson Plans" },
  { href: "/admin/checklists", label: "Checklists" },
  { href: "/admin/forms", label: "Forms" },
  { href: "/admin/policies", label: "Policies" },
  { href: "/admin/activity-overrides", label: "Activity Overrides" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/settings", label: "Account Settings" },
];

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
      navItems={NAV}
      showBack={false}
    >
      {children}
    </AppShell>
  );
}
