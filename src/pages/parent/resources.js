import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentEmpty,
  ParentPageHeader,
  ParentQuickAction,
  ParentSection,
} from "@/components/parent/ParentUI";

export default function ParentResources() {
  return (
    <ParentLayout title="Additional Resources">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Resources"
          title="Additional resources"
          description="Helpful links, guides, and reference material shared by the center."
          accent="sky"
        />

        <ParentSection
          title="Shared resources"
          description="Anything the center publishes for families outside of policies and menus will show up here."
        >
          <ParentEmpty
            title="No additional resources yet"
            description="The center has not published extra resources for families yet. Check back soon."
          />
        </ParentSection>

        <ParentSection
          title="In the meantime"
          description="These pages cover the family information that is already available in the portal."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ParentQuickAction
              href="/parent/policies"
              title="Policies & Procedures"
              description="Handbook policies, pickup rules, illness guidance, and enrollment requirements."
            />
            <ParentQuickAction
              href="/parent/menus"
              title="Menus"
              description="Breakfast, lunch, and snack menus published by the center."
            />
            <ParentQuickAction
              href="/parent/messages"
              title="Messages"
              description="Ask staff directly when you cannot find what you need."
            />
          </div>
        </ParentSection>
      </div>
    </ParentLayout>
  );
}
