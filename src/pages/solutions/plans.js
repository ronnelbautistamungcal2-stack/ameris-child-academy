import Image from "next/image";
import Link from "next/link";
import SolutionsLayout, { BTN, NAVY } from "@/components/solutions/SolutionsLayout";

// Ameris Solutions website: Plans & Features (client mockup 2026-11-06).

const BASE = [
  { title: "Daily Care Tracking", text: "Record attendance, activities, and daily care.", color: "text-blue-600", icon: "M6 3v2M14 3v2M3.5 7h13M4.5 5h11A1 1 0 0116.5 6v9.5a1 1 0 01-1 1h-11a1 1 0 01-1-1V6a1 1 0 011-1zM7 10h1M10 10h1M13 10h1M7 13h1M10 13h1" },
  { title: "Calendar & Events", text: "Manage schedules and upcoming activities.", color: "text-purple-600", icon: "M6 3v2M14 3v2M3.5 7h13M4.5 5h11A1 1 0 0116.5 6v9.5a1 1 0 01-1 1h-11a1 1 0 01-1-1V6a1 1 0 011-1zM7 10h6M7 13h4" },
  { title: "Sign In/Out", text: "Simplify check-in and check-out procedures.", color: "text-green-600", icon: "M7 7a3 3 0 106 0 3 3 0 00-6 0zM4 17a6 6 0 0112 0M14.5 9.5l1.5 1.5 3-3" },
  { title: "Student Performance Reports", text: "Track and share individual progress.", color: "text-blue-600", icon: "M4 16V11M8 16V8M12 16V5M16 16V2" },
  { title: "Meal Plans", text: "Organize menus and meal schedules.", color: "text-orange-500", icon: "M6 2v6a2 2 0 004 0V2M8 8v10M14 2c-1.5 1-2 3-2 5s1 3 2 3v8" },
  { title: "Online Bill Pay", text: "Simplify billing and payment collection.", color: "text-green-600", icon: "M3 6h14v9H3zM3 9h14M6 12.5h3" },
  { title: "Messaging", text: "Keep parents and staff connected.", color: "text-pink-500", icon: "M4 4h12a1 1 0 011 1v7a1 1 0 01-1 1H9l-4 3v-3H4a1 1 0 01-1-1V5a1 1 0 011-1zM7 8.5h.01M10 8.5h.01M13 8.5h.01" },
  { title: "Compliance & Reporting", text: "Stay organized with essential records and reports.", color: "text-red-500", icon: "M5 2h7l4 4v12H5zM12 2v4h4M8 11h5M8 14h5" },
];

const ADD_ONS = [
  {
    title: "Steps of Progression",
    text: "Track child development and milestones with easy-to-use assessment tools and progress reports.",
    image: "/solutions/cheerful-preschool-ring-stacking.jpg",
    alt: "A toddler stacking colorful rings",
    tone: "bg-blue-50 text-blue-800 border-blue-200",
  },
  {
    title: "Teacher Training",
    text: "Provide ongoing training, resources, and professional development for your staff.",
    image: "/solutions/a-warm-classroom-storytime.jpg",
    alt: "A teacher reading a story to children",
    tone: "bg-purple-50 text-purple-800 border-purple-200",
  },
  {
    title: "Staff Management",
    text: "Simplify scheduling, time tracking, evaluations, and staff records.",
    image: "/solutions/professional-checklist-workspace.jpg",
    alt: "A checklist on a clipboard",
    tone: "bg-green-50 text-green-800 border-green-200",
  },
  {
    title: "Curriculum",
    text: "Access ready-to-use lessons, activity ideas, and supply lists to make planning simple and consistent.",
    image: "/solutions/colorful-classroom-still-life.jpg",
    alt: "Books, crayons and an apple on a classroom table",
    tone: "bg-red-50 text-red-800 border-red-200",
  },
];

export default function SolutionsPlans() {
  return (
    <SolutionsLayout title="Plans & Features" description="Our base program and add-ons: everything a childcare program needs in one easy-to-use system.">
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-4 sm:px-6 lg:grid-cols-2">
        <div>
          <h1 className={`font-serif text-4xl font-bold sm:text-5xl ${NAVY}`}>Plans &amp; Features</h1>
          <p className="mt-4 max-w-lg text-lg text-gray-700">
            A complete childcare management system with powerful tools designed to simplify your operations, support your staff, and help children
            learn, grow, and thrive.
          </p>
        </div>
        <div className="relative aspect-[16/10] overflow-hidden rounded-3xl shadow-lg">
          <Image src="/solutions/joyful-classroom-friends-at-the-table.jpg" alt="Children smiling together at a classroom table" fill priority sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-6 sm:p-8">
          <h2 className={`font-serif text-3xl font-bold ${NAVY}`}>Base Program</h2>
          <p className="mt-2 text-gray-700">Our base program brings together a variety of everyday tools in one easy-to-use system.</p>
          <ul className="mt-6 grid gap-x-10 gap-y-5 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-2">
            {BASE.map((f) => (
              <li key={f.title} className="flex gap-4">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`h-9 w-9 shrink-0 ${f.color}`} aria-hidden="true">
                  <path d={f.icon} />
                </svg>
                <div>
                  <h3 className={`font-serif text-lg font-bold ${NAVY}`}>{f.title}</h3>
                  <p className="text-sm text-gray-600">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className={`font-serif text-3xl font-bold ${NAVY}`}>Add-Ons</h2>
        <p className="mt-2 max-w-3xl text-gray-700">
          Customize your system with additional tools designed to meet the unique needs of your childcare program. Choose the add-ons that work best for
          you.
        </p>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ADD_ONS.map((a) => (
            <li key={a.title} className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="relative aspect-[4/3]">
                <Image src={a.image} alt={a.alt} fill sizes="(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
              </div>
              <div className="flex flex-1 flex-col p-5 text-center">
                <h3 className={`font-serif text-lg font-bold ${NAVY}`}>{a.title}</h3>
                <p className="mt-2 flex-1 text-sm text-gray-600">{a.text}</p>
                <Link href={`/solutions/request-quote?addOn=${encodeURIComponent(a.title)}`} className={`mt-4 rounded-lg border px-3 py-2 text-sm font-bold ${a.tone}`}>
                  Learn More
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="flex flex-col items-start gap-5 rounded-3xl border border-blue-100 bg-blue-50/60 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Find the Right Plan for Your Program</h2>
            <p className="mt-1 text-gray-700">
              Every childcare program is unique. Let us help you create the perfect solution with the features and add-ons that best fit your needs.
            </p>
          </div>
          <Link href="/solutions/request-quote" className={`${BTN} shrink-0 px-7 py-3 text-base`}>
            Request a Quote
          </Link>
        </div>
      </section>
    </SolutionsLayout>
  );
}
