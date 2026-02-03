import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";

const NAV_SUBSCRIBER = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/subscriber", label: "Subscription" },
  { href: "/settings", label: "Account Settings" },
];

export default function SubscriberLayout({ title, children }) {
  const { session, status, allowed } = useRequireRole(
    ["SUBSCRIBER"],
    "/dashboard",
  );
  if (status === "loading")
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!allowed)
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;

  return (
    <AppShell
      title={title || "Subscriber"}
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      navItems={NAV_SUBSCRIBER}
      backHref="/dashboard"
    >
      {children}
    </AppShell>
  );
}
