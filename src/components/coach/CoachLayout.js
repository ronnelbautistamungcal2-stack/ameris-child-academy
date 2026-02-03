import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";

const NAV_COACH = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/coach/compliance", label: "Compliance" },
  { href: "/coach/checklists", label: "Follow-ups" },
  { href: "/coach/training", label: "Training" },
  { href: "/coach/reports", label: "Reports" },
  { href: "/coach/policies", label: "Policies" },
  { href: "/settings", label: "Account Settings" },
];

export default function CoachLayout({ title, children }) {
  const { session, status, allowed } = useRequireRole(
    ["COACH", "ADMIN"],
    "/dashboard",
  );
  if (status === "loading")
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!allowed)
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;

  return (
    <AppShell
      title={title || "Coach"}
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      navItems={NAV_COACH}
      backHref="/dashboard"
    >
      {children}
    </AppShell>
  );
}
