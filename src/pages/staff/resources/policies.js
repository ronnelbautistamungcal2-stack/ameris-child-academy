import StaffLayout from "@/components/staff/StaffLayout";
import StaffResourceList from "@/components/staff/StaffResourceList";

export default function StaffPoliciesPage() {
  return (
    <StaffLayout title="Policies & Procedures">
      <StaffResourceList
        heading="Policies & Procedures"
        description="Center policies and standard operating procedures published for your role."
        category="POLICY"
        emptyText="No policies or procedures have been published yet."
      />
    </StaffLayout>
  );
}
