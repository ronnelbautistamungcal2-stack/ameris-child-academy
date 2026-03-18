import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";
import {
  BabyIcon,
  BlocksIcon,
  BookIcon,
  ChevronRightIcon,
  CheckIcon,
  GraduationIcon,
  HeartIcon,
  RocketIcon,
  ShieldIcon,
} from "@/components/public/icons";

const PROGRAMS = [
  {
    title: "Infant Care",
    ageRange: "6 weeks to 18 months",
    description:
      "Responsive care, secure routines, and gentle sensory experiences that help infants feel safe and seen.",
    icon: BabyIcon,
    color: "bg-sky-100 text-sky-700",
    highlights: [
      "Bottle, nap, and diaper updates shared with families",
      "Calm transitions and language-rich interaction",
      "Daily routines built around each infant's pace",
    ],
  },
  {
    title: "Toddler Discovery",
    ageRange: "18 months to 3 years",
    description:
      "Hands-on exploration with movement, language, social practice, and confidence-building routines.",
    icon: BlocksIcon,
    color: "bg-emerald-100 text-emerald-700",
    highlights: [
      "Sensory play, music, and movement every week",
      "Support for communication, routines, and independence",
      "Clear family feedback on behavior and milestones",
    ],
  },
  {
    title: "Preschool Prep",
    ageRange: "3 to 5 years",
    description:
      "Structured early academics, creativity, and executive-function practice to prepare children for their next classroom.",
    icon: BookIcon,
    color: "bg-amber-100 text-amber-700",
    highlights: [
      "Early literacy and math built into play-based lessons",
      "Progress tracking across domains and learning goals",
      "Projects that build attention, confidence, and curiosity",
    ],
  },
  {
    title: "Character & Enrichment",
    ageRange: "Leadership, social skills, and confidence",
    description:
      "Enrichment experiences that help children practice cooperation, self-regulation, leadership, and empathy.",
    icon: RocketIcon,
    color: "bg-blue-100 text-blue-800",
    highlights: [
      "Small-group coaching around social-emotional growth",
      "Activities that build voice, teamwork, and resilience",
      "Stronger continuity between school routines and family communication",
    ],
  },
];

const RHYTHM = [
  {
    title: "Arrival & Connection",
    description:
      "Children settle in with predictable routines, warm handoffs, and a clear picture of the day ahead.",
  },
  {
    title: "Guided Learning",
    description:
      "Teachers rotate between group experiences, targeted activities, and independent exploration.",
  },
  {
    title: "Care & Reflection",
    description:
      "Meals, rest, transitions, and end-of-day updates are documented so families can follow what happened and what comes next.",
  },
];

const FAMILY_VISIBILITY = [
  {
    title: "Daily reports",
    description: "Families can review what their child ate, practiced, completed, or needed support with that day.",
    icon: GraduationIcon,
  },
  {
    title: "Progress updates",
    description: "Lessons, milestones, and goals can be tracked over time instead of disappearing into one-off notes.",
    icon: CheckIcon,
  },
  {
    title: "Consistent communication",
    description: "Messages, reminders, and policy follow-through live in one system instead of scattered chats and paper forms.",
    icon: HeartIcon,
  },
];

const DIFFERENTIATORS = [
  "Age-based learning paths instead of one-size-fits-all activities",
  "Daily family visibility into routines, progress, and communication",
  "A stronger bridge between classroom care and parent follow-through",
  "Operational tools that support teachers, administrators, and families together",
];

export default function ProgramsPage() {
  return (
    <PublicLayout
      title="Programs"
      description="Explore Ameris Child Academy programs, routines, and how families stay connected to daily learning."
    >
      <HeroSection />
      <ProgramsSection />
      <DailyRhythmSection />
      <FamilyVisibilitySection />
      <NextStepSection />
    </PublicLayout>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden py-16 lg:py-20">
      <div className="section-shell">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.22em] text-sky-700 shadow-sm">
              Programs & curriculum
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-gray-900 sm:text-5xl">
              Programs designed around growth, routines, and family visibility.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600">
              Ameris organizes care around what families actually need: warm relationships, clear structure, age-appropriate learning, and reliable daily communication.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-slate-800"
              >
                Schedule a Visit
              </Link>
              <Link
                href="/resources"
                className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white/85 px-6 py-3 text-sm font-extrabold text-gray-900 transition hover:bg-white"
              >
                Compare Family Resources
              </Link>
            </div>
          </div>

          <div className="glass-surface rounded-[32px] p-6">
            <div className="rounded-[28px] bg-gradient-to-br from-sky-100 via-white to-amber-100 p-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
                <ShieldIcon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight text-gray-900">What improves when the program is clear?</h2>
              <ul className="mt-5 space-y-3">
                {DIFFERENTIATORS.map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgramsSection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title">Age-Based Programs</h2>
            <p className="section-copy mt-2 max-w-2xl">
              Each stage combines care routines, developmental support, and clear communication so families know what is being practiced and why.
            </p>
          </div>
          <Link href="/contact" className="inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700">
            Ask about placement <ChevronRightIcon />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {PROGRAMS.map((program) => {
            const Icon = program.icon;
            return (
              <article key={program.title} className="glass-surface rounded-[30px] p-6 lg:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${program.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="mt-4 text-xs font-extrabold uppercase tracking-[0.18em] text-gray-500">{program.ageRange}</div>
                    <h3 className="mt-3 text-2xl font-black tracking-tight text-gray-900">{program.title}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600">{program.description}</p>
                  </div>
                </div>

                <ul className="mt-6 grid gap-3">
                  {program.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm text-gray-700">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DailyRhythmSection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-gradient-to-r from-white/85 via-sky-50/90 to-emerald-50/85 p-8 shadow-[0_28px_60px_-44px_rgba(15,23,42,0.28)] lg:p-12">
          <div className="max-w-2xl">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-700">A typical day</div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-900">A rhythm children can count on.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Predictable structure reduces stress for children, helps teachers stay consistent, and makes family updates easier to trust and understand.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {RHYTHM.map((item, index) => (
              <div key={item.title} className="rounded-[28px] bg-white/85 p-6 shadow-sm">
                <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-sky-700">Step {index + 1}</div>
                <h3 className="mt-3 text-lg font-extrabold text-gray-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FamilyVisibilitySection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title">How Families Stay Connected</h2>
            <p className="section-copy mt-2 max-w-2xl">
              The program is only part of the experience. Families also need a simple way to see routines, progress, messages, and next steps without chasing updates.
            </p>
          </div>
          <Link href="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700">
            Open family portal <ChevronRightIcon />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {FAMILY_VISIBILITY.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="glass-surface rounded-[28px] p-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
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

function NextStepSection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="rounded-[32px] bg-slate-900 px-8 py-10 text-white shadow-[0_32px_70px_-40px_rgba(15,23,42,0.9)] lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-300">Next step</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Find the right fit for your child and your family routine.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Tour the program, ask enrollment questions, and see how the family portal, calendar, and daily updates work together before you commit.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-extrabold text-slate-900 transition hover:bg-slate-100"
              >
                Book a Visit
              </Link>
              <Link
                href="/resources"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-white/10"
              >
                Review Resources
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
