import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";

const NAV_PARENT = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/progress", label: "Progress & Goals" },
  { href: "/parent/forms", label: "Enrollment Docs" },
  { href: "/parent/billing", label: "Billing" },
  { href: "/parent/messages", label: "Messages" },
  { href: "/parent/policies", label: "Policies" },
  { href: "/settings", label: "Account Settings" },
];

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
      navItems={NAV_PARENT}
      backHref="/dashboard"
    >
      {children}
    </AppShell>
  );
}
