import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";
import { COACH_NAV_ITEMS } from "@/components/coach/coachNav";

export default function CoachLayout({
  title,
  children,
  shellMaxWidthClassName,
  contentMaxWidthClassName,
}) {
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
      userImageUrl={session?.user?.pictureUrl}
      userId={session?.user?.id}
      navItems={COACH_NAV_ITEMS}
      shellMaxWidthClassName={shellMaxWidthClassName}
      contentMaxWidthClassName={contentMaxWidthClassName}
      backHref="/dashboard"
    >
      {children}
    </AppShell>
  );
}
