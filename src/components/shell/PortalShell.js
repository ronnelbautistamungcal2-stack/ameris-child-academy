import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import AppShell, { HEADER_BANNER_SRC } from "@/components/shell/AppShell";
import Skeleton from "@/components/ui/Skeleton";
import { ADMIN_NAV_ITEMS } from "@/components/admin/adminNav";
import { STAFF_NAV_ITEMS } from "@/components/staff/staffNav";
import { TEACHER_NAV_ITEMS } from "@/components/teacher/teacherNav";
import { PARENT_NAV_ITEMS } from "@/components/parent/parentNav";
import { COACH_NAV_ITEMS } from "@/components/coach/coachNav";
import { SUBSCRIBER_NAV_ITEMS } from "@/components/subscriber/subscriberNav";
import { apiJson } from "@/lib/api";
import { useNewMessages, useUserSocket } from "@/hooks/useSocket";

const FALLBACK_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Account Settings" },
];

function navForRole(role) {
  if (role === "ADMIN") return ADMIN_NAV_ITEMS;
  if (role === "TEACHER") return TEACHER_NAV_ITEMS;
  if (role === "OTHER_STAFF") return STAFF_NAV_ITEMS;
  if (role === "COACH") return COACH_NAV_ITEMS;
  if (role === "PARENT") return PARENT_NAV_ITEMS;
  if (role === "SUBSCRIBER") return SUBSCRIBER_NAV_ITEMS;
  return FALLBACK_NAV;
}

function findNavLabel(items, path) {
  for (const item of items || []) {
    if (item?.href === path) return item.label;
    if (item?.children) {
      const found = findNavLabel(item.children, path);
      if (found) return found;
    }
  }
  return "";
}

const ShellTitleContext = createContext(() => {});

/**
 * Lets a page name itself in the shared shell without owning the shell. Pages
 * mount and unmount underneath a single PortalShell, so the title is the only
 * thing that needs to travel upward.
 */
export function useShellTitle(title) {
  const setTitle = useContext(ShellTitleContext);

  useEffect(() => {
    if (!title) return undefined;
    setTitle(title);
    return () => setTitle("");
  }, [title, setTitle]);
}

/**
 * The one shell for every signed-in portal page. It is mounted by _app.js and
 * stays mounted while pages swap underneath it, so the sidebar, the banner
 * header, and the unread badge never blink or reset on navigation.
 */
export default function PortalShell({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const role = session?.user?.role || "";
  const userId = session?.user?.id;
  const isParent = role === "PARENT";
  const activePath = (router.asPath || "/").split("?")[0];

  const [pageTitle, setPageTitle] = useState("");
  const setTitle = useCallback((value) => setPageTitle(value || ""), []);

  // Signed out: bounce to login once, from here, instead of every page doing it.
  useEffect(() => {
    if (status !== "unauthenticated") return;
    router.replace(`/login?callbackUrl=${encodeURIComponent(router.asPath)}`);
  }, [status, router]);

  // Parent-only routes stay parent-only.
  useEffect(() => {
    if (status !== "authenticated" || !role) return;
    if (activePath.startsWith("/parent") && !isParent) {
      router.replace("/dashboard");
    }
  }, [status, role, isParent, activePath, router]);

  // Unread message count for the parent nav badge.
  const [unreadCount, setUnreadCount] = useState(0);
  const socket = useUserSocket(isParent ? userId : null);

  const refreshUnreadCount = useCallback(async () => {
    if (!isParent || !userId) return;
    try {
      const threads = await apiJson("/api/v1/messages/threads");
      setUnreadCount(
        Array.isArray(threads)
          ? threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0)
          : 0,
      );
    } catch {
      /* the badge is decoration; a failed refresh should not break the shell */
    }
  }, [isParent, userId]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useNewMessages(
    socket,
    useCallback(
      (message) => {
        if (message?.senderId === userId) return;
        refreshUnreadCount();
      },
      [refreshUnreadCount, userId],
    ),
  );

  const navItems = useMemo(() => {
    const base = navForRole(role);
    if (!isParent) return base;
    return base.map((item) =>
      item.href === "/parent/messages" ? { ...item, badge: unreadCount } : item,
    );
  }, [role, isParent, unreadCount]);

  const title = useMemo(() => {
    if (pageTitle) return pageTitle;
    return findNavLabel(navItems, activePath) || "Dashboard";
  }, [pageTitle, navItems, activePath]);

  return (
    <ShellTitleContext.Provider value={setTitle}>
      <AppShell
        title={title}
        userName={session?.user?.name || session?.user?.email}
        userLabel={session?.user?.email}
        userImageUrl={session?.user?.pictureUrl}
        userId={userId}
        navItems={navItems}
        shellMaxWidthClassName="max-w-[1760px]"
        contentMaxWidthClassName="max-w-[1400px]"
        showBack={false}
        sidebarVariant={isParent ? "navy" : "light"}
        bannerSrc={isParent ? HEADER_BANNER_SRC : ""}
        bannerTagline={isParent ? "From Blessings to Pillars" : ""}
      >
        {status === "authenticated" ? children : <Skeleton count={6} />}
      </AppShell>
    </ShellTitleContext.Provider>
  );
}
