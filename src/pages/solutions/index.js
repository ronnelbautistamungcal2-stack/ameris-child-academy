import Image from "next/image";
import Link from "next/link";
import SolutionsLayout, { BTN, BTN_OUTLINE, NAVY } from "@/components/solutions/SolutionsLayout";

// Ameris Solutions website: Home (client mockup 2026-11-06).

const PILLARS = [
  { title: "Center Management", text: "Keep your center organized and running smoothly." },
  { title: "Child Development", text: "Track milestones and individual progress to guide personalized support." },
  { title: "Family Connection", text: "Share important updates and keep families involved in their child's day." },
  { title: "Staff Management", text: "Manage schedules, training and performance in one place." },
  { title: "Classrooms & Curriculum", text: "Access ready-to-use lessons and tools for managing daily classroom activities." },
  { title: "Compliance & Reporting", text: "Simplify compliance and make confident decisions." },
];

export default function SolutionsHome() {
  return (
    <SolutionsLayout description="Childcare management made simple: a smarter solution that simplifies daily operations and supports student development.">
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-2">
        <div>
          <h1 className={`font-serif text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl ${NAVY}`}>Childcare Management Made Simple</h1>
          <p className="mt-5 max-w-md text-lg text-gray-700">A smarter solution that simplifies daily operations and supports student development.</p>
          <div className="mt-8 flex max-w-xs flex-col gap-3">
            <Link href="/solutions/plans" className={`${BTN} py-3 text-base`}>
              View Plans &amp; Features
            </Link>
            <Link href="/solutions/request-quote?demo=1" className={`${BTN_OUTLINE} py-3 text-base`}>
              Request a Demo ›
            </Link>
          </div>
        </div>
        <div className="relative aspect-[16/10] overflow-hidden rounded-3xl shadow-xl">
          <Image
            src="/solutions/a-warm-classroom-storytime.jpg"
            alt="A teacher reading a story to young children"
            fill
            priority
            sizes="(min-width: 1024px) 560px, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <section aria-label="What Ameris Solutions does" className="border-y border-blue-100 bg-gradient-to-b from-white to-blue-50/60">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 py-8 sm:px-6 md:grid-cols-3 lg:grid-cols-6">
          {PILLARS.map((p) => (
            <li key={p.title} className="px-3 py-3 text-center">
              <h2 className={`font-serif text-base font-bold ${NAVY}`}>{p.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{p.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className={`font-serif text-4xl font-bold leading-tight ${NAVY}`}>Built by Childcare Professionals</h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-700">
            Ameris Solutions was created from real-world experience operating a childcare center. We understand the daily challenges you face, and we
            built a system to make your work easier, so you can focus on what matters most: helping children thrive.
          </p>
          <Link href="/solutions/request-quote" className={`${BTN} mt-8`}>
            Request a Quote
          </Link>
        </div>
        <div className="relative aspect-[16/10] overflow-hidden rounded-3xl shadow-xl">
          <Image src="/solutions/building-bright-futures-together.jpg" alt="A teacher building with blocks alongside three children" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
        </div>
      </section>
    </SolutionsLayout>
  );
}
