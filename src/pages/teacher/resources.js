import TeacherLayout from "@/components/teacher/TeacherLayout";
import Link from "next/link";

const RESOURCE_LINKS = [
  {
    href: "/teacher/lessons",
    title: "Lesson Plans & Training Media",
    description:
      "Lesson plans, curriculum media, and supporting materials for your age groups.",
    accent: "sky",
  },
  {
    href: "/teacher/milestone-checklists",
    title: "Milestone Checklists",
    description:
      "Reference checklists for the milestones tracked in progression tracking.",
    accent: "emerald",
  },
  {
    href: "/teacher/staff-advancement",
    title: "Staff Advancement Steps",
    description:
      "The advancement steps and requirements for moving up in your role.",
    accent: "indigo",
  },
  {
    href: "/teacher/children",
    title: "Children Directory",
    description:
      "Profiles, contacts, and enrollment details for the children in your center.",
    accent: "amber",
  },
];

const ACCENT_CLASSES = {
  sky: "border-sky-200 bg-sky-50 hover:border-sky-300",
  emerald: "border-emerald-200 bg-emerald-50 hover:border-emerald-300",
  indigo: "border-indigo-200 bg-indigo-50 hover:border-indigo-300",
  amber: "border-amber-200 bg-amber-50 hover:border-amber-300",
};

export default function TeacherResources() {
  return (
    <TeacherLayout title="Additional Resources">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">
          Additional Resources
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Supporting tools and reference material outside of your day-to-day
          classroom pages. Policies and procedures live on their own page.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {RESOURCE_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-xl border p-4 transition",
                ACCENT_CLASSES[item.accent] || "border-gray-200 bg-gray-50",
              ].join(" ")}
            >
              <div className="text-sm font-extrabold text-gray-900">
                {item.title}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {item.description}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Looking for the handbook? Open{" "}
          <Link
            href="/teacher/policies"
            className="font-semibold text-sky-700 hover:text-sky-800"
          >
            Policies &amp; Procedures
          </Link>
          .
        </div>
      </div>
    </TeacherLayout>
  );
}
