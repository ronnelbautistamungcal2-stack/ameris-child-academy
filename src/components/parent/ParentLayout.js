import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";
import { PARENT_NAV_ITEMS } from "@/components/parent/parentNav";
import { apiJson } from "@/lib/api";
import { useUserSocket, useNotifications } from "@/hooks/useSocket";

export default function ParentLayout({ title, children }) {
  const { session, status, allowed } = useRequireRole(["PARENT"], "/dashboard");
  const [unreadCount, setUnreadCount] = useState(0);
  const userId = session?.user?.id;
  const socket = useUserSocket(userId);

  // Fetch unread count on mount
  useEffect(() => {
    if (!userId) return;
    apiJson("/api/v1/notifications?limit=1")
      .then((data) => setUnreadCount(data.unreadCount || 0))
      .catch(() => {});
  }, [userId]);

  // Update count on real-time notifications
  useNotifications(
    socket,
    useCallback((notification) => {
      setUnreadCount((prev) => prev + 1);
    }, []),
  );

  // Inject badge into Messages nav item
  const navItems = useMemo(() => {
    return PARENT_NAV_ITEMS.map((item) => {
      if (item.href === "/parent/messages") {
        return { ...item, badge: unreadCount };
      }
      return item;
    });
  }, [unreadCount]);

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
      userId={userId}
      navItems={navItems}
      backHref="/dashboard"
    >
      {children}
    </AppShell>
  );
}
