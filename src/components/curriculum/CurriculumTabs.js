import Link from "next/link";

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
  return (
    <nav aria-label="Curriculum" className="overflow-x-auto">
      <div className="flex min-w-max gap-1.5">
        {CURRICULUM_TABS.map((tab) => {
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
