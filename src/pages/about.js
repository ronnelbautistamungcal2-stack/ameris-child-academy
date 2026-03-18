import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";
import {
  AwardIcon,
  BlocksIcon,
  BookIcon,
  BuildingIcon,
  CheckIcon,
  HeartIcon,
  UsersIcon,
} from "@/components/public/icons";

const PROMISES = [
  {
    title: "Warm relationships",
    description: "Children learn faster and settle more easily when adults are consistent, calm, and responsive.",
    icon: HeartIcon,
    color: "bg-rose-100 text-rose-600",
  },
  {
    title: "Clear structure",
    description: "Families and teachers do better when routines, expectations, and next steps are easy to follow.",
    icon: BuildingIcon,
    color: "bg-sky-100 text-sky-700",
  },
  {
    title: "Visible growth",
    description: "Progress matters more when it can be documented, shared, and used to guide the next step in learning.",
    icon: AwardIcon,
    color: "bg-amber-100 text-amber-700",
  },
];

const PILLARS = [
  {
    title: "Care and learning belong together",
    description:
      "Daily routines are not separate from development. Feeding, rest, transitions, play, and communication all shape how a child grows.",
    icon: BlocksIcon,
  },
  {
    title: "Families need more than updates",
    description:
      "Parents need context they can trust: what happened, what was practiced, and what support or follow-up matters next.",
    icon: UsersIcon,
  },
  {
    title: "Teachers need systems that help them teach",
    description:
      "A strong classroom experience depends on tools that support documentation, communication, and consistency instead of creating extra friction.",
    icon: BookIcon,
  },
];

const FAMILY_EXPECTATIONS = [
  "Clear communication around routines, changes, and next steps",
  "A more consistent bridge between the classroom and home",
  "Learning experiences that match a child's stage instead of generic busywork",
  "A system that supports staff, administrators, and families together",
];

export default function AboutPage() {
  return (
    <PublicLayout
      title="About"
      description="Learn how Ameris Child Academy approaches early learning, family communication, and daily program structure."
    >
      <HeroSection />
      <PromisesSection />
      <PillarsSection />
      <FamilyExpectationsSection />
      <JoinSection />
    </PublicLayout>
  );
}

function HeroSection() {
  return (
    <section className="py-16 lg:py-20">
      <div className="section-shell">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.22em] text-sky-700 shadow-sm">
              About Ameris
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-gray-900 sm:text-5xl">
              Built around children, but designed to work for families too.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600">
              Ameris is centered on a simple idea: strong early learning comes from warm care, consistent structure, and communication families can actually use.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
              That philosophy shows up in the classroom experience and in the app itself, where routines, progress, messages, and operational follow-through stay connected.
            </p>
          </div>

          <div className="glass-surface rounded-[32px] p-6">
            <div className="rounded-[28px] bg-gradient-to-br from-sky-100 via-white to-amber-100 p-6">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-700">What families should feel</div>
              <ul className="mt-5 space-y-3">
                <li className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-gray-800">
                  Confident that the day was structured and intentional.
                </li>
                <li className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-gray-800">
                  Informed about routines, progress, and classroom expectations.
                </li>
                <li className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-gray-800">
                  Supported by a team that communicates clearly and consistently.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PromisesSection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="text-center">
          <h2 className="section-title">What Shapes the Experience</h2>
          <p className="section-copy mx-auto mt-3 max-w-2xl">
            These are the standards that matter most when families evaluate whether a center and its systems are truly working.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PROMISES.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="glass-surface rounded-[28px] p-6 text-center">
                <div className={`mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-extrabold text-gray-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PillarsSection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-gradient-to-r from-white/85 via-sky-50/90 to-emerald-50/85 p-8 shadow-[0_28px_60px_-44px_rgba(15,23,42,0.28)] lg:p-12">
          <div className="max-w-2xl">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-700">Our approach</div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-900">Why the program and the platform are connected.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              The experience feels stronger when care routines, lessons, communication, and operational follow-through all support the same outcome instead of competing with each other.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title} className="rounded-[28px] bg-white/85 p-6 shadow-sm">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-extrabold text-gray-900">{pillar.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-600">{pillar.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function FamilyExpectationsSection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h2 className="section-title">What Families Can Expect</h2>
            <p className="section-copy mt-3 max-w-xl">
              The best childcare experience is not only warm. It is also clear. Families should understand the rhythm, the expectations, and the communication flow.
            </p>
          </div>

          <div className="grid gap-3">
            {FAMILY_EXPECTATIONS.map((item) => (
              <div key={item} className="glass-surface flex items-start gap-3 rounded-[24px] px-5 py-4">
                <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <p className="text-sm leading-6 text-gray-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function JoinSection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="rounded-[32px] bg-slate-900 px-8 py-10 text-white shadow-[0_32px_70px_-40px_rgba(15,23,42,0.9)] lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-300">Next step</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight">See whether the fit is right for your family.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Ask about program placement, visit the center, or review how the family portal, routines, and updates work together.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-extrabold text-slate-900 transition hover:bg-slate-100"
              >
                Contact the Team
              </Link>
              <Link
                href="/programs"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-white/10"
              >
                Explore Programs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
