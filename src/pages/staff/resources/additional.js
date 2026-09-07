import StaffLayout from "@/components/staff/StaffLayout";
import StaffResourceList from "@/components/staff/StaffResourceList";

export default function StaffAdditionalResourcesPage() {
  return (
    <StaffLayout title="Additional Resources">
      <StaffResourceList
        heading="Additional Resources"
        description="Reference material, guides, and other documents shared with your role."
        category="RESOURCE"
        emptyText="No additional resources have been published yet."
      />
    </StaffLayout>
  );
}
