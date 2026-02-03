import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/teacher", label: "Teacher Console" },
  { href: "/teacher/children", label: "My Children" },
  { href: "/teacher/logs", label: "Daily Logging" },
  { href: "/teacher/checklists", label: "Checklists" },
  { href: "/teacher/lessons", label: "Lesson Plans" },
  { href: "/teacher/policies", label: "Policies" },
  { href: "/teacher/metrics", label: "Reports" },
  { href: "/settings", label: "Account Settings" },
];

export default function TeacherLayout({ title, children }) {
  const { session, status, allowed } = useRequireRole(
    ["TEACHER"],
    "/dashboard",
  );
  if (status === "loading")
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!allowed)
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;

  return (
    <AppShell
      title={title || "Teacher"}
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      navItems={NAV}
      showBack={false}
    >
      {children}
    </AppShell>
  );
}
