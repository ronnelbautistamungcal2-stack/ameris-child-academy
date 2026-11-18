import Link from "next/link";
import { useCurriculumScope } from "@/components/curriculum/CurriculumScope";
import { useAddOns } from "@/components/subscription/AddOnGate";

// The Curriculum tabs from the client's mockups (2026-10-02). Each tab is its
// own page; this bar sits at the top of all of them.
export const CURRICULUM_TABS = [
  { key: "calendar", label: "Lesson Calendar", href: "/admin/curriculum/calendar" },
  { key: "planner", label: "Lesson Planner", href: "/admin/curriculum/planner" },
  { key: "bank", label: "Lesson Bank", href: "/admin/lessons" },
  { key: "categories", label: "Categories", href: "/admin/curriculum?tab=categories" },
  { key: "steps", label: "Steps of Progression Bank", href: "/admin/curriculum?tab=lessons" },
];

export default function CurriculumTabs({ active }) {
  const { account } = useAddOns();
  const scope = useCurriculumScope();
  // Global admin > Lesson Bank & SOP edits the banks and planner (client sheet
  // 10-29 (9), rows 4/5). In the Admin portal, subscribers (step E) and Ameris
  // Academy itself only get the Lesson Calendar.
  const tabs = scope.global
    ? CURRICULUM_TABS.filter((t) => scope.tabHrefs[t.key]).map((t) => ({ ...t, href: scope.tabHrefs[t.key] }))
    : account?.amerisCurriculum || account?.curriculumOwner
      ? CURRICULUM_TABS.filter((t) => t.key === "calendar")
      : CURRICULUM_TABS;
  if (tabs.length === 1) return null;
  return (
    <nav aria-label="Curriculum" className="overflow-x-auto">
      <div className="flex min-w-max gap-1.5">
        {tabs.map((tab) => {
          const current = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                current
                  ? "border-[#0b2a5b] bg-[#0b2a5b] text-white"
                  : "border-gray-300 bg-white text-[#0b2a5b] hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:text-blue-100"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
