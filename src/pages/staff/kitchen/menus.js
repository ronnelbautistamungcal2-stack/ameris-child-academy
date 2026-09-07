import StaffLayout from "@/components/staff/StaffLayout";
import { WorkspaceHero, WorkspacePill, WorkspaceState } from "@/components/ui/Workspace";
import { isKitchenStaff } from "@/lib/roles";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export default function StaffKitchenMenusPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const kitchenStaff = isKitchenStaff(session?.user);

  useEffect(() => {
    if (status === "loading") return;
    if (session?.user && !kitchenStaff) router.replace("/staff/dashboard");
  }, [kitchenStaff, router, session?.user, status]);

  if (status !== "loading" && session?.user && !kitchenStaff) {
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;
  }

  return (
    <StaffLayout title="Menus">
      <div className="space-y-5">
        <WorkspaceHero
          eyebrow="Kitchen"
          title="Menus"
          description="Weekly meal planning for the kitchen team."
          meta={<WorkspacePill tone="amber">Kitchen staff only</WorkspacePill>}
        />

        <WorkspaceState
          title="Menus are not set up yet."
          description="This page is reserved for the kitchen menu planner. The menu structure will be defined in a later phase; until then, meal-related tasks stay on your daily Checklist."
        />
      </div>
    </StaffLayout>
  );
}
