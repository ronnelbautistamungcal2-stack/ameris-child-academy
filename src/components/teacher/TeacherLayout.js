import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";
import { TEACHER_NAV_ITEMS } from "@/components/teacher/teacherNav";

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
      userImageUrl={session?.user?.pictureUrl}
      userId={session?.user?.id}
      navItems={TEACHER_NAV_ITEMS}
      showBack={false}
    >
      {children}
    </AppShell>
  );
}
