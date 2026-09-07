import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentEmpty,
  ParentPageHeader,
  ParentSection,
} from "@/components/parent/ParentUI";

export default function ParentMenus() {
  return (
    <ParentLayout title="Menus">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Resources"
          title="Menus"
          description="Breakfast, lunch, and snack menus for the center will be published here."
          accent="emerald"
        />

        <ParentSection
          title="Published menus"
          description="Once the center posts a menu it will appear here so you can plan the week at home."
        >
          <ParentEmpty
            title="No menus published yet"
            description="The center has not shared a menu for this page yet. Check back soon, or reach out through Messages if you need meal details in the meantime."
          />
        </ParentSection>
      </div>
    </ParentLayout>
  );
}
