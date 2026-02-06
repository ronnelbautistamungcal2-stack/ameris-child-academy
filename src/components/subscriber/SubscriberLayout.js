import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";
import { SUBSCRIBER_NAV_ITEMS } from "@/components/subscriber/subscriberNav";

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
      userImageUrl={session?.user?.pictureUrl}
      navItems={SUBSCRIBER_NAV_ITEMS}
      backHref="/dashboard"
    >
      {children}
    </AppShell>
  );
}
