import StaffLayout from "@/components/staff/StaffLayout";
import MenuPlanner from "@/components/menus/MenuPlanner";
import { WorkspaceHero, WorkspacePill } from "@/components/ui/Workspace";
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
    <StaffLayout title="Menus" contentMaxWidthClassName="max-w-[1440px]">
      <div className="space-y-5">
        <WorkspaceHero
          eyebrow="Kitchen"
          title="Menus"
          description="The weekly menu planned by the center admin."
          meta={<WorkspacePill tone="amber">Kitchen staff only</WorkspacePill>}
        />

        <MenuPlanner title="Menu" />
      </div>
    </StaffLayout>
  );
}
