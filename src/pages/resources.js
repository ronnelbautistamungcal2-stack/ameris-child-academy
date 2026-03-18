import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";
import {
  ArrowRightIcon,
  BookIcon,
  CalendarIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  GraduationIcon,
  HeartIcon,
  MailIcon,
  PhoneIcon,
} from "@/components/public/icons";
import { PUBLIC_CONTACT } from "@/components/public/siteData";

const RESOURCE_GROUPS = [
  {
    title: "Getting Started",
    description: "Everything families typically need before they enroll.",
    items: [
      {
        title: "Compare programs",
        description: "Review age ranges, routines, and how each program supports development.",
        href: "/programs",
        icon: GraduationIcon,
        color: "bg-sky-100 text-sky-700",
      },
      {
        title: "Book a visit",
        description: "Ask questions about readiness, schedules, and what daily communication looks like.",
        href: "/contact",
        icon: HeartIcon,
        color: "bg-rose-100 text-rose-600",
      },
      {
        title: "Review the yearly calendar",
        description: "See holidays, training days, and major dates families may want to plan around.",
        href: "/calendar",
        icon: CalendarIcon,
        color: "bg-amber-100 text-amber-700",
      },
    ],
  },
  {
    title: "For Enrolled Families",
    description: "Key areas that support day-to-day follow-through once a child is enrolled.",
    items: [
      {
        title: "Open the family portal",
        description: "Access updates, records, progress, billing, forms, and communication in one place.",
        href: "/login",
        icon: BookIcon,
        color: "bg-emerald-100 text-emerald-700",
      },
      {
        title: "Call the front office",
        description: "Use a direct call for urgent pickup, attendance, or same-day routine changes.",
        href: PUBLIC_CONTACT.phoneHref,
        icon: PhoneIcon,
        color: "bg-blue-100 text-blue-700",
        external: true,
      },
      {
        title: "Email the support team",
        description: "Use email for questions about forms, visits, enrollment, or follow-up details.",
        href: `mailto:${PUBLIC_CONTACT.email}`,
        icon: MailIcon,
        color: "bg-indigo-100 text-indigo-700",
        external: true,
      },
    ],
  },
];

const SUPPORT_STEPS = [
  {
    title: "1. Start with the right page",
    description: "Program questions are easiest to answer after comparing age groups, routines, and family visibility.",
  },
  {
    title: "2. Bring your enrollment questions",
    description: "Ask about schedules, transitions, child readiness, forms, medication, and communication expectations.",
  },
  {
    title: "3. Keep one point of contact",
    description: "Using the portal, calendar, and support team consistently reduces confusion later on.",
  },
];

export default function ResourcesPage() {
  return (
    <PublicLayout
      title="Resources"
      description="Find the main pages, contact paths, and family tools that make Ameris Child Academy easier to navigate."
    >
      <HeroSection />
      <ResourceCollectionsSection />
      <SupportSection />
    </PublicLayout>
  );
}

function HeroSection() {
  return (
    <section className="py-16 lg:py-20">
      <div className="section-shell">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.22em] text-sky-700 shadow-sm">
              Family resources
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-gray-900 sm:text-5xl">
              The fastest path to the information families ask for most.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600">
              This page trims out the noise and points families to the parts of the app that are most helpful before and after enrollment.
            </p>
          </div>

          <div className="glass-surface rounded-[30px] p-6">
            <div className="rounded-[28px] bg-gradient-to-br from-white via-sky-50 to-emerald-50 p-6">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-700">Quick access</div>
              <ul className="mt-5 space-y-3">
                <li className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-gray-800">
                  Compare programs before asking about availability.
                </li>
                <li className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-gray-800">
                  Use the calendar to plan around closures and training days.
                </li>
                <li className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-gray-800">
                  Use the family portal for updates, forms, and progress once enrolled.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResourceCollectionsSection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="space-y-12">
          {RESOURCE_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="section-title">{group.title}</h2>
                  <p className="section-copy mt-2 max-w-2xl">{group.description}</p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
                {group.items.map((item) => (
                  <ResourceCard key={item.title} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ResourceCard({ item }) {
  const Icon = item.icon;
  const Action = item.external ? "a" : Link;
  const actionProps = item.external
    ? { href: item.href }
    : { href: item.href };

  return (
    <div className="glass-surface rounded-[28px] p-6">
      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-xl font-extrabold text-gray-900">{item.title}</h3>
      <p className="mt-3 text-sm leading-6 text-gray-600">{item.description}</p>
      <Action
        {...actionProps}
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-700"
      >
        Open resource {item.external ? <ExternalLinkIcon /> : <ChevronRightIcon />}
      </Action>
    </div>
  );
}

function SupportSection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-900 px-8 py-10 text-white shadow-[0_28px_60px_-40px_rgba(15,23,42,0.9)] lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-300">Support flow</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Make questions easier to answer the first time.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Families get a better experience when contact, scheduling, program information, and day-to-day updates stay connected instead of living across separate tools.
              </p>

              <div className="mt-8 space-y-3">
                {SUPPORT_STEPS.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <h3 className="text-sm font-extrabold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] bg-white/8 p-6">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-300">Need one-on-one help?</div>
              <h3 className="mt-3 text-2xl font-black tracking-tight">Talk to the team.</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                If the right next step is not obvious, start with a visit request and the team can point you to the correct workflow.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-slate-900 transition hover:bg-slate-100"
                >
                  Request a Visit
                </Link>
                <Link
                  href="/programs"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-white/10"
                >
                  Compare Programs
                </Link>
                <a
                  href={PUBLIC_CONTACT.phoneHref}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-white/10"
                >
                  Call {PUBLIC_CONTACT.phoneDisplay} <ArrowRightIcon className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
