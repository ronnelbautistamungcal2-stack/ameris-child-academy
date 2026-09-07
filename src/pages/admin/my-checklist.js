import AdminLayout from "@/components/admin/AdminLayout";
import StaffChecklistWorkspace from "@/components/staff/StaffChecklistWorkspace";
import { useSession } from "next-auth/react";

export default function AdminMyChecklist() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id || "";

  return (
    <StaffChecklistWorkspace
      Layout={AdminLayout}
      title="My Checklist"
      staffUserId={userId}
      scopeReady={status !== "loading" && !!userId}
      description="The checklist assigned to you. Use Program Setup › Checklist Manager to build or edit checklists for other staff."
    />
  );
}
